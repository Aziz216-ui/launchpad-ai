# Espace comptable — LaunchPad (microservices)

L'espace comptable de LaunchPad : un comptable suit les dossiers des startups qui lui sont confiés, consulte leurs
documents comptables et financiers, les **valide ou les rejette** avec un commentaire, et **échange des messages** avec l'entrepreneur.

Il est découpé en **4 microservices**, un par entité qui a un CRUD. Chacun est un sous-module autonome : son propre
projet Symfony, son port, sa base de données, ses migrations, ses fixtures et ses tests.

| Microservice | Entités (tables) | Port | Base | Nom Eureka |
|---|---|---|---|---|
| [`workspace-service`](workspace-service) | `AccountantWorkspace` | **8091** | `workspace_db` | `ACCOUNTING-WORKSPACE-SERVICE` |
| [`client-file-service`](client-file-service) | `ClientFile` + historique `ClientFileAssignment` | **8092** | `client_file_db` | `ACCOUNTING-CLIENT-FILE-SERVICE` |
| [`document-service`](document-service) | `AccountingDocument` + historiques `Validation`, `DocumentEvent` | **8093** | `document_db` | `ACCOUNTING-DOCUMENT-SERVICE` |
| [`message-service`](message-service) | `Message` | **8094** | `message_db` | `ACCOUNTING-MESSAGE-SERVICE` |
| [`common`](common) | — (module partagé, pas un service) | — | — | — |

Les historiques (`ClientFileAssignment`, `Validation`, `DocumentEvent`) n'ont pas de CRUD : ils sont écrits par les actions
de leur entité parente et restent dans le même service et la même base qu'elle.

| | |
|---|---|
| Stack | PHP 8.2+ (testé en 8.4), Symfony 7.4 LTS, Doctrine ORM 3, MySQL / MariaDB |
| Préfixe des routes publiques | `/api/comptable` (identique pour les 4 services) |
| Authentification | JWT Keycloak (`Authorization: Bearer …`), validé par chaque service |
| Appels entre services | **Synchrone** : HTTP JSON sur `/internal/**`, protégé par une clé partagée (`X-Internal-Key`) — **asynchrone** : événements JSON via **RabbitMQ** (AMQP) |

---

## Sommaire

1. [Architecture](#1-architecture)
2. [Installation et lancement](#2-installation-et-lancement)
3. [Configuration](#3-configuration)
4. [Keycloak](#4-keycloak)
5. [Droits d'accès](#5-droits-daccès)
6. [Conventions de l'API](#6-conventions-de-lapi)
7. [Endpoints](#7-endpoints)
8. [Accès depuis le frontend](#8-accès-depuis-le-frontend)
9. [Eureka](#9-eureka)
10. [Tests](#10-tests)
11. [Structure du code](#11-structure-du-code)
12. [Communication asynchrone avec RabbitMQ](#12-communication-asynchrone-avec-rabbitmq)

---

## 1. Architecture

```
                      Frontend Angular (proxy par chemin, voir §8)
   /workspaces, /me        /files           /files/{id}/documents   /files/{id}/messages
                                            /documents/**           /messages/**
          │                  │                       │                      │
          ▼                  ▼                       ▼                      ▼
  workspace-service   client-file-service     document-service       message-service
        :8091                :8092                  :8093                  :8094
          │                  │                       │                      │
    workspace_db       client_file_db           document_db            message_db

  Appels synchrones (HTTP /internal/**, en-tête X-Internal-Key) — une réponse est attendue :
    (2) client-file-service  ──► workspace-service     lecture d'un espace (demande, affectation)
    (3) document-service     ──► client-file-service   contexte d'un dossier (droits, statut)
        message-service      ──► client-file-service   idem
    (4) message-service      ──► document-service      document cité dans un message

  Événements asynchrones (RabbitMQ, queues durables) — aucune réponse attendue :
    (1) workspace-service ──► [client_file.workspace_status] ──► client-file-service   espace activé / désactivé
    (5) document-service  ──► [message.document_decided]     ──► message-service       document validé / rejeté
```

### Règles du découpage

- **Une base par service**, sans aucune clé étrangère vers une autre base : un dossier est référencé ailleurs par son
  UUID (`client_file_id`), un document cité dans un message par le sien (`document_id`).
- **Les données d'un autre service ne sont lues que par son API interne**, jamais dans sa base.
- **Copies locales assumées** : `client_file` garde l'identifiant, le nom et l'état (`workspace_active`) de l'espace
  affecté pour ne pas appeler workspace-service à chaque lecture. workspace-service les tient à jour en publiant
  un événement RabbitMQ à chaque activation / désactivation (flux 1).
- Les historiques restent avec leur entité (même transaction, même base).

### Appels entre services

| # | Appelant → appelé | Moyen | Quand |
|---|---|---|---|
| 1 | workspace → client-file | **RabbitMQ**, queue `client_file.workspace_status` | Un admin active / désactive un espace : client-file met à jour ses dossiers et refuse les demandes en attente (§12) |
| 2 | client-file → workspace | HTTP `GET /internal/workspaces/{id}` | Demande de dossier (comptable disponible ?) et affectation (espace actif ?) |
| 3 | document, message → client-file | HTTP `GET /internal/files/{id}` → contexte du dossier | À chaque requête sur les documents / messages d'un dossier (droits d'accès, statut) |
| 4 | message → document | HTTP `GET /internal/documents/{id}` | Un message cite un document : il doit exister, appartenir au dossier et ne pas être supprimé |
| 5 | document → message | **RabbitMQ**, queue `message.document_decided` | Un comptable valide / rejette un document : l'entrepreneur reçoit une notification dans le fil du dossier (§12) |

Règle de choix : **HTTP quand l'appelant a besoin de la réponse pour continuer** (droits d'accès, disponibilité),
**RabbitMQ quand il informe simplement un autre service** d'un événement, sans attendre de réponse.

Le **contexte d'un dossier** (`FileContext`) contient `id`, `reference`, `status`, `entrepreneurId`, `accountantId` et
`workspaceActive` : c'est tout ce qu'il faut à document-service et message-service pour appliquer exactement les mêmes
droits qu'avant le découpage (classe `ActorResolver` du module commun). Il est mis en cache le temps d'une requête.

**Pannes** : si le service appelé en HTTP est injoignable ou répond en erreur, l'appelant renvoie **503 `SERVICE_UNAVAILABLE`**
sans rien modifier. Avec RabbitMQ, le consommateur peut être arrêté : ses messages attendent dans la queue (voir §12).

Les routes `/internal/**` sont hors du firewall Keycloak mais exigent l'en-tête `X-Internal-Key` égal à `INTERNAL_API_KEY`
(sinon **401 `INVALID_INTERNAL_KEY`**). Elles ne doivent jamais être exposées au frontend ni à Internet.

### Module commun (`common/`)

Code partagé, chargé par chaque service via son `composer.json` (`"Launchpad\\Common\\": "../common/src/"`) :
sécurité Keycloak et jetons de dev, format d'erreur JSON, pagination, Swagger, Eureka, `/health`, contexte de dossier et
`ActorResolver`, client HTTP interne, protection des routes `/internal`, catalogue des données de démonstration
(`FixtureCatalog` : mêmes UUID dans toutes les bases), et outils de test (`common/testing`).

### Modèle de données

Le code est en anglais ; voici la correspondance avec les termes métier.

| Terme métier (FR) | Classe | Table | Service |
|---|---|---|---|
| Espace comptable | `AccountantWorkspace` | `accountant_workspace` | workspace |
| Dossier client | `ClientFile` | `client_file` | client-file |
| Historique d'affectation | `ClientFileAssignment` | `client_file_assignment` | client-file |
| Document comptable | `AccountingDocument` | `accounting_document` | document |
| Validation | `Validation` | `validation` | document |
| Événement de document | `DocumentEvent` | `document_event` | document |
| Message | `Message` | `message` | message |

- Identifiants internes : **UUID v7** (`symfony/uid`), stockés en `BINARY(16)`.
- Utilisateurs : **aucune table d'utilisateurs**. Seul l'identifiant Keycloak (claim `sub`) est stocké ; les noms affichés
  sont des copies tirées du jeton, pas une source de vérité.

| Enum | Valeurs |
|---|---|
| `ClientFileStatus` | `PENDING` (demande) → `ACTIVE` (acceptée / affectée) ou `REJECTED` (refusée) ; `ACTIVE` → `CLOSED` |
| `AssignmentType` | `ACCEPTANCE`, `ADMIN_ASSIGNMENT`, `ADMIN_REASSIGNMENT` |
| `DocumentStatus` | `PENDING`, `VALIDATED`, `REJECTED` |
| `ValidationDecision` | `VALIDATED`, `REJECTED` |
| `DocumentSource` | `UPLOAD`, `EXTERNAL` |
| `DocumentType` | `BALANCE_SHEET`, `INCOME_STATEMENT`, `INVOICE`, `BANK_STATEMENT`, `FINANCIAL_FORECAST`, `BUDGET`, `TAX_RETURN`, `PAYROLL`, `REPORT`, `OTHER` |
| `UserRole` (commun) | `ACCOUNTANT`, `ENTREPRENEUR`, `ADMIN` |
| `DocumentEventType` | `DELETED` |

Les règles métier sont inchangées par rapport au service unique d'origine :

- **Espaces** : créés à la première requête d'un comptable (`acceptingClients = false`) ; l'annuaire ne liste que les espaces
  `active && acceptingClients`. Un admin peut désactiver un espace : ses demandes `PENDING` sont refusées automatiquement
  (motif « Espace comptable désactivé ») et ses dossiers `ACTIVE` passent en lecture seule pour le comptable jusqu'à leur réaffectation.
- **Dossiers** : demande `PENDING` de l'entrepreneur (une seule ouverte par startup et par comptable), acceptation ou refus
  (motif obligatoire) par le comptable, affectation / réaffectation par un admin (motif obligatoire pour une réaffectation).
  Un dossier `REJECTED` ou `CLOSED` est en lecture seule.
- **Documents** : dépôt sur un dossier `ACTIVE` uniquement (PDF, PNG, JPG, XLSX ; 10 Mo ; type MIME réel vérifié).
  Déposé par l'entrepreneur : `PENDING` ; par le comptable : `VALIDATED` d'office. Rejet et révision avec commentaire,
  nouvelle version après un rejet, suppression logique.
- **Messages** : sur un dossier `PENDING` ou `ACTIVE`, entre l'entrepreneur et le comptable ; marqués comme lus par le destinataire.

---

## 2. Installation et lancement

### Prérequis

- PHP **8.2+** avec les extensions `pdo_mysql`, `intl`, `mbstring`, `xml`, `fileinfo`, `openssl`, `sodium`, `zip`, `curl`
- Composer 2
- MySQL ou MariaDB (XAMPP convient : MariaDB 10.4)
- RabbitMQ (avec Erlang) et l'extension PHP `sockets` (`extension=sockets` dans `php.ini`) — voir §12

> Sous Windows, si le PHP de XAMPP est trop ancien (8.0), installez un PHP 8.2+ séparé (ex. `C:\php84`) et gardez MariaDB de XAMPP.

### Tout installer et tout lancer

Créez d'abord le `.env.local` de chaque service (voir §3), puis, depuis `Backend/Professional-Service` :

```powershell
.\scripts\install.ps1      # composer install, création des 4 bases, migrations, données de démo
.\scripts\start.ps1        # 4 fenêtres : un service par fenêtre (composer serve)
```

```bash
./scripts/install.sh       # idem sous Linux / macOS / Git Bash
./scripts/start.sh         # les 4 services en arrière-plan, Ctrl+C pour tout arrêter
```

`-NoFixtures` (PowerShell) ou `--no-fixtures` (bash) installe sans données de démonstration.

### Un service à la fois

```bash
cd Backend/Professional-Service/document-service
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:fixtures:load --no-interaction   # facultatif
composer serve                                            # port APP_PORT (8093 ici)
```

Vérification : `curl http://127.0.0.1:8093/api/comptable/health` → `{"status":"UP","service":"document-service"}`

Un service démarre seul, mais ses fonctions qui dépendent d'un autre service répondent **503** tant que celui-ci est arrêté
(ex. document-service sans client-file-service). Pour l'application complète, lancez les quatre.

### Swagger (documentation interactive)

Chaque service documente ses propres routes : `http://127.0.0.1:<port>/api/comptable/docs`
(spécification OpenAPI : `/api/comptable/docs.json`). Pour tester une route protégée : **Authorize**, puis collez un
access token Keycloak (sans `Bearer`) ou, en dev, un alias des fixtures (`sonia`, `amine`, `nadia`…).

---

## 3. Configuration

Chaque service a son `.env` (versionné, sans secret) ; les valeurs propres à votre poste vont dans son **`.env.local`**
(ignoré par Git), et dans **`.env.test.local`** pour les tests.

### Exemple de `.env.local` (document-service)

```dotenv
APP_SECRET=remplacez_par_une_chaine_aleatoire_de_32_caracteres
DATABASE_URL="mysql://root:@127.0.0.1:3306/document_db?serverVersion=10.4.32-MariaDB&charset=utf8mb4"
# Facultatif
EUREKA_ENABLED=true
```

Générer un secret : `php -r "echo bin2hex(random_bytes(16));"`. Changez le nom de la base pour chaque service
(`workspace_db`, `client_file_db`, `document_db`, `message_db`). Pour les tests, `.env.test.local` contient la même
`DATABASE_URL` : le suffixe `_test` est ajouté automatiquement.

### Variables propres au découpage

| Variable | Services | Défaut | Description |
|---|---|---|---|
| `APP_PORT` | tous | 8091 / 8092 / 8093 / 8094 | Port de `composer serve` |
| `APP_SERVICE_NAME` | tous | nom du dossier | Renvoyé par `/health`, affiché dans Swagger |
| `DATABASE_URL` | tous | base du service | Une base différente par service |
| `INTERNAL_API_KEY` | tous | `launchpad-dev-internal-key` | Clé des routes `/internal` : **la même dans les 4 services**, à remplacer hors développement |
| `WORKSPACE_SERVICE_URL` | client-file | `http://127.0.0.1:8091` | Base URL de workspace-service |
| `CLIENT_FILE_SERVICE_URL` | document, message | `http://127.0.0.1:8092` | Base URL de client-file-service |
| `DOCUMENT_SERVICE_URL` | message | `http://127.0.0.1:8093` | Base URL de document-service |
| `DOCUMENT_STORAGE_DIR` / `DOCUMENT_MAX_SIZE` | document | `var/uploads` / `10M` | Stockage **privé** des fichiers déposés |
| `EUREKA_APP_NAME` | tous | voir tableau d'en-tête | Nom d'enregistrement dans Eureka |

| `RABBITMQ_HOST` / `RABBITMQ_PORT` | tous | `localhost` / `5672` | Broker RabbitMQ (port AMQP) |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` / `RABBITMQ_VHOST` | tous | `guest` / `guest` / `/` | Identifiants du broker (ceux par défaut de RabbitMQ en local) |

Les variables Keycloak (`KEYCLOAK_*`) et Eureka (`EUREKA_*`) sont les mêmes qu'avant, dans chaque service.
En Docker, les URL des services deviennent `http://<nom-du-conteneur>:<port>`.

> document-service : `upload_max_filesize` et `post_max_size` du `php.ini` doivent être au moins égaux à `DOCUMENT_MAX_SIZE`
> (par exemple `10M` et `12M`), sinon PHP refuse le fichier avant Symfony.

---

## 4. Keycloak

### Ce que vérifie chaque service

Chaque requête publique (`/api/comptable/**`) doit porter `Authorization: Bearer <JWT>`. Le jeton est validé **localement** par le handler OIDC de Symfony :

- **signature** RS256, avec les clés publiques obtenues par découverte
  (`{KEYCLOAK_ISSUER}/.well-known/openid-configuration` → JWKS), **mises en cache** ;
- **expiration** (`exp`) et date d'émission (`iat`) ;
- **émetteur** (`iss`) = `KEYCLOAK_ISSUER` ;
- **audience** (`aud`) contient `KEYCLOAK_AUDIENCE`.

Identité : `sub` (UUID Keycloak). Claims lus pour l'affichage si présents : `email`, `given_name`, `family_name`, `preferred_username`.
Le firewall est **stateless** (aucune session).

Réponses : **401** JSON si le jeton est absent ou invalide, **403** JSON si le rôle est insuffisant.

### Configuration à faire dans Keycloak (pour l'administrateur Keycloak)

1. **Rôles de realm** : *Realm roles* > *Create role* : `ACCOUNTANT`, `ENTREPRENEUR`, `ADMIN`
   (noms modifiables : adaptez alors `KEYCLOAK_ROLE_*`). Affectez-les aux utilisateurs (*Users* > *Role mapping*).
   Pour utiliser plutôt des rôles du client `launchpad-app`, créez-les dans *Clients* > *launchpad-app* > *Roles*
   et mettez `KEYCLOAK_USE_CLIENT_ROLES=true`.

2. **Audience mapper (obligatoire)** : par défaut, Keycloak émet `aud: "account"`, ce que le service refuse.
   - *Client scopes* > *Create client scope*
     - Name : `launchpad-app-audience`
     - Type : `Default`, Protocol : `OpenID Connect`, *Include in token scope* : ON → *Save*
   - Onglet *Mappers* > *Configure a new mapper* > **Audience**
     - Name : `launchpad-app-audience`
     - *Included Client Audience* : `launchpad-app`
     - *Included Custom Audience* : *(vide)*
     - *Add to access token* : **ON** ; *Add to ID token* : OFF ; *Add to token introspection* : ON → *Save*
   - *Clients* > `launchpad-app` > onglet *Client scopes* > *Add client scope* > `launchpad-app-audience` > **Default**.

   Vérification : décodez un access token (par exemple sur jwt.io) ; `aud` doit contenir `"launchpad-app"`.

3. **Émetteur** : le claim `iss` dépend de l'URL par laquelle le jeton a été obtenu. Elle doit être identique à `KEYCLOAK_ISSUER`
   (ex. `http://localhost:8180/realms/launchpad`). En Docker, fixez `KC_HOSTNAME` pour garder une URL publique stable.

4. **Jeton de test en ligne de commande** : activez *Direct access grants* sur le client `launchpad-app`
   (*Clients* > `launchpad-app` > *Settings* > *Capability config*). À réserver au développement.

### Obtenir un jeton de test

```bash
# Client public
curl -s -X POST "http://localhost:8180/realms/launchpad/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=launchpad-app" \
  -d "username=sonia" \
  -d "password=MotDePasseDeTest" \
  -d "scope=openid"

# Client confidentiel : ajoutez -d "client_secret=<secret du client>"
```

Récupérer directement le jeton (avec `jq`) :

```bash
TOKEN=$(curl -s -X POST "http://localhost:8180/realms/launchpad/protocol/openid-connect/token" \
  -d "grant_type=password" -d "client_id=launchpad-app" \
  -d "username=sonia" -d "password=MotDePasseDeTest" | jq -r .access_token)
```

PowerShell :

```powershell
$TOKEN = (Invoke-RestMethod -Method Post -Uri "http://localhost:8180/realms/launchpad/protocol/openid-connect/token" `
  -Body @{ grant_type="password"; client_id="launchpad-app"; username="sonia"; password="MotDePasseDeTest" }).access_token
```

### Appeler l'API avec ce jeton

```bash
# Directement sur un service
curl -H "Authorization: Bearer $TOKEN" http://localhost:8091/api/comptable/me
curl -H "Authorization: Bearer $TOKEN" http://localhost:8092/api/comptable/files

# Via le proxy du frontend (ng serve), qui route vers le bon service
curl -H "Authorization: Bearer $TOKEN" http://localhost:4200/api/comptable/files

# En dev, sans Keycloak : un alias des fixtures sert de jeton
curl -H "Authorization: Bearer amine" http://localhost:8092/api/comptable/files
```

```powershell
Invoke-RestMethod -Uri "http://localhost:8091/api/comptable/me" -Headers @{ Authorization = "Bearer $TOKEN" }
```

### Utilisateurs des fixtures

Les fixtures utilisent ces `sub`. Pour tester avec les données de démonstration, créez des utilisateurs Keycloak
avec ces identifiants (import de realm), ou remplacez-les dans `common/src/Fixtures/FixtureUsers.php`.
En dev, chaque service accepte aussi l'alias en minuscules comme jeton (`sonia`, `amine`, `nadia`…, voir `DevAccessTokenHandler`).

| Persona | Rôle | `sub` |
|---|---|---|
| Sonia Ben Ammar | ACCOUNTANT | `7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01` |
| Karim Trabelsi | ACCOUNTANT | `7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c02` |
| Claire Dubois (espace fermé aux demandes) | ACCOUNTANT | `7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c03` |
| Youssef Mansouri (espace désactivé) | ACCOUNTANT | `7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c04` |
| Amine Jaziri (AgriSense) | ENTREPRENEUR | `e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a01` |
| Leïla Haddad (MediConnect) | ENTREPRENEUR | `e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a02` |
| Thomas Moreau (ÉcoLivraison) | ENTREPRENEUR | `e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a03` |
| Nadia Khelifi | ADMIN | `ad5e1c00-3b7a-4d2f-9e8c-1a2b3c4d5e01` |

---

## 5. Droits d'accès

Les règles sont appliquées par des **Voters** Symfony : `ClientFileVoter` (client-file-service), `FileContextVoter`
(module commun, pour les documents et messages d'un dossier), `AccountingDocumentVoter` et `MessageVoter`.
Ils s'appuient tous sur `ActorResolver` (module commun). Les règles d'état (statut du dossier ou du document)
sont vérifiées par les services métier et renvoient **409**.

| Action | Entrepreneur (propriétaire) | Comptable affecté | Admin |
|---|---|---|---|
| Lister les espaces disponibles | ✅ | ✅ | ✅ (`?all=true` : tous) |
| Ouvrir / fermer son espace aux demandes | — | ✅ | — |
| Activer / désactiver un espace | — | — | ✅ |
| Créer / modifier une demande de dossier | ✅ (`PENDING`) | — | — |
| Accepter / refuser une demande | — | ✅ | — |
| Affecter / réaffecter | — | — | ✅ |
| Clôturer | — | ✅ | ✅ |
| Voir dossiers, documents, messages, historiques | ✅ | ✅ (même espace désactivé) | ✅ |
| Déposer un fichier | ✅ → `PENDING` | ✅ → `VALIDATED` | — |
| Déclarer un document externe | ✅ | — | — |
| Nouvelle version | ✅ (version précédente `REJECTED`) | — | — |
| Valider / rejeter / réviser | — | ✅ | — |
| Supprimer (logiquement) | ✅ ses documents `PENDING` | ✅ ses documents | — |
| Envoyer un message | ✅ (`PENDING`/`ACTIVE`) | ✅ (`PENDING`/`ACTIVE`) | — |
| Marquer un message comme lu | ✅ (destinataire) | ✅ (destinataire) | — |

Un comptable ne voit que les dossiers **actuellement** affectés à son espace (ou les demandes qui lui sont adressées).
Si son espace est désactivé, il garde la lecture seule.

---

## 6. Conventions de l'API

- Corps des requêtes : `application/json`, sauf dépôt de fichier en `multipart/form-data`.
- Dates : ISO 8601 (`2026-10-19T14:32:05+00:00`) ; périodes : `AAAA-MM-JJ`.
- Messages d'erreur et de validation en français.

### Réponses

```json
{ "data": { "...": "..." } }
```

Listes paginées (`?page=1&limit=20`, `limit` plafonné à **100**) :

```json
{
  "data": [ { "...": "..." } ],
  "meta": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
}
```

Le format des listes est produit par `DefaultPaginationFormatter`. Pour adopter un format commun à l'équipe,
il suffit de fournir une autre implémentation de `PaginationFormatterInterface` (`config/services.yaml` de chaque service).

### Erreurs

```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_FAILED",
    "message": "Les données envoyées sont invalides.",
    "details": [
      { "field": "startupName", "message": "Cette valeur ne doit pas être vide." }
    ]
  }
}
```

| Code HTTP | `code` | Cas |
|---|---|---|
| 200 / 201 / 204 | — | Succès / création / suppression |
| 400 | `VALIDATION_FAILED`, `BAD_REQUEST`, `SAME_DECISION` | Données invalides, JSON malformé, décision identique |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `INVALID_INTERNAL_KEY` | Jeton absent ; jeton invalide ou expiré ; clé interne absente ou fausse (routes `/internal`) |
| 403 | `FORBIDDEN` | Rôle ou droits insuffisants |
| 404 | `NOT_FOUND` | Ressource inexistante (ou document supprimé) |
| 405 / 415 | `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE` | Méthode ou type de contenu non pris en charge |
| 409 | `INVALID_STATUS`, `FILE_NOT_ACTIVE`, `FILE_CLOSED`, `DUPLICATE_FILE`, `WORKSPACE_UNAVAILABLE`, `WORKSPACE_INACTIVE`, `ALREADY_ASSIGNED`, `NEWER_VERSION_EXISTS`, `VERSIONING_NOT_ALLOWED`, `VALIDATION_NOT_APPLICABLE`, `EXTERNAL_DOCUMENT` | Action incompatible avec l'état actuel |
| 500 | `INTERNAL_ERROR` | Erreur inattendue (détail technique ajouté uniquement en `dev`) |
| 503 | `SERVICE_UNAVAILABLE` | Un autre microservice nécessaire à l'action est injoignable ou en erreur |

---

## 7. Endpoints

Tous les chemins publics sont préfixés par `/api/comptable`. `{id}` est un UUID. Les corps et réponses sont identiques
à ceux du service unique d'origine.

| Méthode | Chemin | Service | Rôle(s) | Description |
|---|---|---|---|---|
| GET | `/health`, `/docs`, `/docs.json` | chacun | public | Santé, Swagger UI et spécification du service |
| GET | `/me` | workspace | tous | Identité lue dans le jeton, rôles reconnus, `workspaceId` |
| GET | `/workspaces` | workspace | tous | Comptables disponibles (admin : `?all=true`) |
| GET | `/workspaces/me` | workspace | ACCOUNTANT | Mon espace (créé au besoin) |
| PATCH | `/workspaces/me` | workspace | ACCOUNTANT | `{ "acceptingClients": true }` |
| PATCH | `/workspaces/{id}/status` | workspace | ADMIN | `{ "active": false }` ; les dossiers sont mis à jour en différé (RabbitMQ) |
| GET | `/files` | client-file | tous | Dossiers visibles (`?status=`, pagination) |
| POST | `/files` | client-file | ENTREPRENEUR | Demande de dossier |
| GET | `/files/{id}` | client-file | voir | Détail d'un dossier |
| PATCH | `/files/{id}` | client-file | ENTREPRENEUR | Modifier une demande `PENDING` |
| POST | `/files/{id}/accept` | client-file | ACCOUNTANT | Accepter une demande |
| POST | `/files/{id}/reject` | client-file | ACCOUNTANT | Refuser (`reason` obligatoire) |
| POST | `/files/{id}/assign` | client-file | ADMIN | Affecter / réaffecter (`workspaceId`, `reason`) |
| POST | `/files/{id}/close` | client-file | ACCOUNTANT, ADMIN | Clôturer |
| GET | `/files/{id}/assignments` | client-file | voir | Historique d'affectation |
| GET | `/files/{id}/documents` | document | voir | Documents (`?includeHistory=true`, `?status=`, `?type=`) |
| POST | `/files/{id}/documents` | document | ENTREPRENEUR, ACCOUNTANT | Dépôt de fichier (multipart) |
| POST | `/files/{id}/documents/external` | document | ENTREPRENEUR | Déclarer un document externe |
| GET | `/documents/{id}` | document | voir | Détail d'un document |
| GET | `/documents/{id}/download` | document | voir | Téléchargement (droits vérifiés) |
| DELETE | `/documents/{id}` | document | ENTREPRENEUR, ACCOUNTANT | Suppression logique |
| POST | `/documents/{id}/versions` | document | ENTREPRENEUR | Nouvelle version (multipart) |
| POST | `/documents/{id}/versions/external` | document | ENTREPRENEUR | Nouvelle version externe |
| POST | `/documents/{id}/validate` | document | ACCOUNTANT | Valider (commentaire obligatoire pour une révision) |
| POST | `/documents/{id}/reject` | document | ACCOUNTANT | Rejeter (commentaire obligatoire) |
| GET | `/documents/{id}/validations` | document | voir | Historique des décisions |
| GET | `/documents/{id}/events` | document | voir | Historique des événements |
| GET | `/files/{id}/messages` | message | voir | Fil de discussion (le plus récent d'abord) |
| POST | `/files/{id}/messages` | message | ENTREPRENEUR, ACCOUNTANT | Envoyer un message (`content`, `documentId` facultatif) |
| POST | `/messages/{id}/read` | message | destinataire | Marquer comme lu |

Routes internes (sans préfixe `/api/comptable`, clé `X-Internal-Key`) : voir le tableau des appels entre services (§1).

```bash
curl -H "X-Internal-Key: launchpad-dev-internal-key" http://127.0.0.1:8092/internal/files/019a2000-0000-7000-8000-000000000001
```

---

## 8. Accès depuis le frontend

Il n'y a pas de Gateway : le frontend envoie chaque chemin au service qui le sert. En développement, c'est le proxy
du serveur Angular qui s'en charge (`Frontend/proxy.conf.mjs`), avec les règles les plus précises d'abord :

| Chemin | Service |
|---|---|
| `/api/comptable/files/{id}/documents`, `/api/comptable/documents/**` | document-service (8093) |
| `/api/comptable/files/{id}/messages`, `/api/comptable/messages/**` | message-service (8094) |
| `/api/comptable/files/**` | client-file-service (8092) |
| `/api/comptable/workspaces/**`, `/api/comptable/me` | workspace-service (8091) |

Le navigateur ne voit qu'une seule origine : aucun en-tête CORS n'est nécessaire et les services n'en envoient pas.
En production, reproduisez ces règles dans le serveur web qui sert le frontend (même origine), par exemple avec nginx :

```nginx
location ~ ^/api/comptable/(files/[^/]+/documents|documents) { proxy_pass http://document-service:8093; }
location ~ ^/api/comptable/(files/[^/]+/messages|messages)   { proxy_pass http://message-service:8094; }
location ^~ /api/comptable/files                             { proxy_pass http://client-file-service:8092; }
location ~ ^/api/comptable/(workspaces|me)                   { proxy_pass http://workspace-service:8091; }
# Ne jamais exposer /internal/**
```

---

## 9. Eureka

Avec `EUREKA_ENABLED=true` dans son `.env.local`, chaque service s'enregistre au lancement de `composer serve`
(commande `app:eureka:register` du module commun) sous son propre nom : `ACCOUNTING-WORKSPACE-SERVICE`, `ACCOUNTING-CLIENT-FILE-SERVICE`,
`ACCOUNTING-DOCUMENT-SERVICE`, `ACCOUNTING-MESSAGE-SERVICE`. Le lien de chaque instance dans le tableau de bord (http://localhost:8761) ouvre
son Swagger UI. Fonctionnement : enregistrement (`POST /eureka/apps/{NOM}`), battement de cœur toutes les
`EUREKA_HEARTBEAT_INTERVAL` secondes, désinscription à l'arrêt (Ctrl+C) ; une instance tuée brutalement est retirée au bout de 90 s.

Les appels entre services utilisent les URL configurées (`*_SERVICE_URL`), pas la découverte Eureka.

---

## 10. Tests

Dans chaque service :

```bash
composer test
```

Le script recrée la base `<base>_test`, exécute les migrations, charge les fixtures, puis lance PHPUnit. Chaque test
s'exécute dans une transaction annulée à la fin (`dama/doctrine-test-bundle`).

| Service | Tests | Contenu |
|---|---|---|
| workspace-service | 44 | Espaces, `/me`, sécurité JWT, Swagger, routes internes, publication RabbitMQ **et tests unitaires du module commun** |
| client-file-service | 27 | Cycle de vie des dossiers, affectations, consommation des événements d'espace, contexte interne |
| document-service | 22 | Dépôt, versions, validations, suppression, droits, route interne, publication des décisions |
| message-service | 16 | Fil de discussion, document cité, droits, notifications reçues via RabbitMQ |

- **Aucun Keycloak réel n'est nécessaire** : une paire de clés RSA de test est générée dans `var/test-keys` et
  `TestTokenFactory` (module commun) signe des JWT au format Keycloak.
- **Aucun autre service n'est nécessaire** : en environnement de test, les appels HTTP vers les autres services sont
  remplacés par des doublures alimentées par `FixtureCatalog` (`FakeClientFileDirectory`, `FakeWorkspaceDirectory`,
  `FakeDocumentDirectory`), modifiables par le test (ex. espace désactivé).
- **Aucun RabbitMQ n'est nécessaire** : `FakeMessagePublisher` garde en mémoire les messages publiés (le test vérifie leur
  contenu, ou simule un broker injoignable) ; les consommateurs sont testés en appelant directement leur `handle()`.
- Simuler un utilisateur : `$this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', "/documents/$id/validate");`
  Appeler une route interne : `$this->internal('GET', "/files/$id");`
- Windows : si la génération des clés échoue, définissez `OPENSSL_CONF` (par ex. `C:\php84\extras\ssl\openssl.cnf`).

---

## 11. Structure du code

```
Professional-Service/
├── common/                       Module partagé (namespace Launchpad\Common)
│   ├── src/
│   │   ├── ApiDoc/ Controller/   Swagger, /health
│   │   ├── Discovery/ Command/   Enregistrement Eureka
│   │   ├── Exception/ EventListener/ Http/   Erreurs JSON, pagination, résolution du contexte de dossier
│   │   ├── Fixtures/             FixtureUsers (sub Keycloak) et FixtureCatalog (UUID partagés)
│   │   ├── Remote/               Client HTTP interne, ClientFileDirectory, FileContext
│   │   └── Security/             Keycloak, jetons de dev, ActorResolver, FileContextVoter, clé interne
│   ├── testing/                  ApiTestCase, jetons et Keycloak simulés, doublure de client-file-service
│   └── tests/Unit/               Tests unitaires du module (lancés depuis workspace-service)
├── workspace-service/            Symfony : src/{Controller,Entity,Internal,Remote,Service,...}, migrations, tests
├── client-file-service/
├── document-service/
├── message-service/
└── scripts/                      install / start (PowerShell et bash)
```

Dans chaque service, `src/Controller` contient les routes publiques (`/api/comptable`), `src/Internal` les routes
`/internal`, et `src/Remote` les clients des autres services (interface + implémentation HTTP, remplacée en test).

- **Stockage remplaçable** (document-service) : implémentez `DocumentStorageInterface` (S3, MinIO…) et changez l'alias dans
  `config/services.yaml`. Les fichiers ne sont jamais servis publiquement : seul `/documents/{id}/download` y donne accès.
- **Références de dossier** : `DOS-AAAA-NNNNNN`, séquence annuelle protégée par un index unique (client-file-service).
- **Ajouter un service appelé** : une interface dans `src/Remote`, une implémentation HTTP basée sur `RemoteService`
  (module commun), un client « scopé » dans `config/packages/framework.yaml`, et une doublure pour `when@test`.

---

## 12. Communication asynchrone avec RabbitMQ

Mise en œuvre de l'atelier « Communication asynchrone entre les micro-services — RabbitMQ », transposée de Spring AMQP
à Symfony avec [`php-amqplib`](https://github.com/php-amqplib/php-amqplib) (implémentation PHP du protocole AMQP).

### Les deux flux

| Flux | Producteur | Queue (durable) | Consommateur | Traitement |
|---|---|---|---|---|
| 1 | workspace-service (`WorkspaceService::setActive`) | `client_file.workspace_status` | client-file-service (`WorkspaceStatusListener`) | Dossiers de l'espace en lecture seule ; demandes en attente refusées |
| 2 | document-service (`DocumentService::decide`) | `message.document_decided` | message-service (`DocumentDecidedListener`) | Notification automatique dans le fil du dossier (badge « Notification » dans le front) |

### Correspondance avec l'atelier (Spring → Symfony)

| Atelier (Spring AMQP) | Projet (module commun `Launchpad\Common\Messaging`) |
|---|---|
| `spring.rabbitmq.host / port / username / password` | `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST` (`.env`) |
| `JobDTO` (dans les deux services) | DTO partagés `Message\WorkspaceStatusChanged`, `Message\DocumentDecided` |
| `RabbitMQConfig.CANDID_JOB_QUEUE` | `Queues::CLIENT_FILE_WORKSPACE_STATUS`, `Queues::MESSAGE_DOCUMENT_DECIDED` |
| `Jackson2JsonMessageConverter` | sérialisation JSON (`toArray()` / `fromArray()`), `content_type: application/json` |
| `RabbitTemplate.convertAndSend(queue, dto)` (`JobProducer`) | `MessagePublisher::publish(queue, dto)` → `AmqpMessagePublisher` |
| `new Queue(name, true)` déclarée côté consommateur | `QueueConsumer::declareQueues()` : chaque consommateur déclare sa queue, durable |
| `@RabbitListener(queues = …)` (`JobConsumer`) | classe implémentant `QueueListener` (`queue()` + `handle()`), découverte automatiquement |
| démarrage de l'application consommatrice | `php bin/console app:rabbitmq:consume` (processus d'écoute) |

Les règles de l'atelier sont respectées :

- **Le consommateur déclare la queue** (meilleure pratique) ; le producteur publie en ne connaissant que son nom, sur
  l'exchange par défaut. Lancez donc les consommateurs **avant** les producteurs (`scripts/start.ps1` le fait).
- **Queue inexistante** : le message est publié « mandatory » avec confirmation du broker ; si personne n'a déclaré la queue,
  RabbitMQ le renvoie et l'envoi échoue (l'équivalent du 404 NOT_FOUND de l'atelier).
- **Tolérance aux pannes** : queues durables et messages persistants. Si client-file-service ou message-service est arrêté,
  les messages attendent dans la queue et sont traités à son redémarrage, dans l'ordre (FIFO, un message à la fois).
- **Acquittement manuel** : un message n'est retiré de la queue qu'une fois traité. En cas d'erreur, il est remis une fois
  dans la queue, puis écarté et journalisé pour ne pas bloquer les suivants.
- **Sauvegarde puis envoi** (comme `JobService.saveAndSendJob`) :
  - flux 1 : sauvegarde et publication dans **une même transaction** ; si RabbitMQ est injoignable, la désactivation est annulée (**503**) ;
  - flux 2 : la décision du comptable est enregistrée même si RabbitMQ est injoignable ; seule la notification est perdue (erreur journalisée).

### Étape 1 : installer et démarrer RabbitMQ (Windows)

1. Installer **Erlang** (OTP), requis par RabbitMQ, puis **RabbitMQ Server** (installateurs fournis sur Blackboard ou les sites officiels).
2. Ajouter `C:\Program Files\RabbitMQ Server\rabbitmq_server-x.x.x\sbin` à la variable `PATH`.
3. Dans une invite de commandes **administrateur** :
   ```bat
   rabbitmq-plugins enable rabbitmq_management
   rabbitmq-service start
   rabbitmqctl status
   ```
4. Interface d'administration : http://localhost:15672 (`guest` / `guest`).
5. Côté PHP : activer l'extension `sockets` (ligne `extension=sockets` du `php.ini`, utilisée par `php-amqplib`) ;
   vérification : `php -m` doit lister `sockets`.

### Étape 2 : lancer et tester

```powershell
# Consommateurs d'abord : ils déclarent leurs queues
cd client-file-service ; php bin/console app:rabbitmq:consume     # fenêtre 1
cd message-service     ; php bin/console app:rabbitmq:consume     # fenêtre 2
# Puis les API (ou tout en une fois : .\scripts\start.ps1)
```

`app:rabbitmq:consume --setup` déclare seulement les queues puis s'arrête ; `--limit=N` et `--idle-timeout=S` arrêtent
l'écoute après N messages ou S secondes sans message.

**Flux 2 (notification)** — un comptable rejette un document :

```bash
curl -X POST http://127.0.0.1:8093/api/comptable/documents/019a3000-0000-7000-8000-000000000002/reject \
  -H "Authorization: Bearer sonia" -H "Content-Type: application/json" -d '{"comment": "Le relevé est illisible."}'
```

Dans la console de message-service :

```
[info] Message reçu depuis la queue message.document_decided
[info] Notification envoyée à l'entrepreneur : document « Relevé bancaire — mars 2026 » rejeté
```

puis `GET http://127.0.0.1:8094/api/comptable/files/019a2000-0000-7000-8000-000000000001/messages` (jeton `amine`) renvoie
la notification en premier, avec `"automatic": true`. Dans le front, elle apparaît dans l'onglet Messages du dossier.

**Flux 1 (désactivation)** — `PATCH http://127.0.0.1:8091/api/comptable/workspaces/{id}/status` avec `{"active": false}`
(jeton `nadia`), puis la console de client-file-service affiche `Espace … désactivé : N demande(s) en attente refusée(s)`.

**Tolérance aux pannes** : arrêtez le consommateur de message-service, rejetez un document, puis regardez la queue
`message.document_decided` dans l'onglet *Queues* de http://localhost:15672 : le message y attend (*Ready* = 1).
Relancez le consommateur : il le traite aussitôt.
