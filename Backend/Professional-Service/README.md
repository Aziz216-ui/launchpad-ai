# Service comptable (Espace Comptable) — LaunchPad

Microservice REST/JSON qui gère les **espaces des comptables** de la plateforme LaunchPad.
Un comptable suit les dossiers des startups qui lui sont confiés : il consulte les documents
comptables et financiers, les **valide ou les rejette** avec un commentaire, et **échange des messages** avec l'entrepreneur.

| | |
|---|---|
| Stack | PHP 8.2+ (testé en 8.4), Symfony 7.4 LTS (squelette API), Doctrine ORM 3, MySQL / MariaDB |
| Préfixe des routes | `/api/comptable` |
| Port de développement | `8085` (variable `APP_PORT`) |
| Base de données | `accounting_db` (isolée : aucune référence à une autre base) |
| Authentification | JWT Keycloak (`Authorization: Bearer …`) relayé par la Gateway |

---

## Sommaire

1. [Modèle de données](#1-modèle-de-données)
2. [Installation et lancement](#2-installation-et-lancement)
3. [Configuration (.env / .env.local)](#3-configuration)
4. [Keycloak : configuration et jeton de test](#4-keycloak)
5. [Droits d'accès](#5-droits-daccès)
6. [Conventions de l'API](#6-conventions-de-lapi)
7. [Endpoints](#7-endpoints)
8. [Route Spring Cloud Gateway](#8-route-spring-cloud-gateway)
9. [Tests](#9-tests)
10. [Structure du code et choix techniques](#10-structure-du-code-et-choix-techniques)

---

## 1. Modèle de données

Le code est en anglais ; voici la correspondance avec les termes métier.

| Terme métier (FR) | Classe | Table | Rôle |
|---|---|---|---|
| Espace comptable | `AccountantWorkspace` | `accountant_workspace` | Espace d'un comptable, créé automatiquement à sa première requête |
| Dossier client | `ClientFile` | `client_file` | Suivi d'une startup par un comptable |
| Historique d'affectation | `ClientFileAssignment` | `client_file_assignment` | Acceptation, affectation et réaffectation d'un dossier |
| Document comptable | `AccountingDocument` | `accounting_document` | Fichier déposé (`UPLOAD`) ou référence externe (`EXTERNAL`) |
| Validation | `Validation` | `validation` | Décision du comptable (historique, jamais modifiée) |
| Événement de document | `DocumentEvent` | `document_event` | Traçabilité (suppression logique) |
| Message | `Message` | `message` | Échange entrepreneur ↔ comptable dans un dossier |

- Identifiants internes : **UUID v7** (`symfony/uid`), stockés en `BINARY(16)`.
- Utilisateurs : **aucune table d'utilisateurs**. Seul l'identifiant Keycloak (claim `sub`) est stocké
  (`accountantId`, `entrepreneurId`, `uploadedBy`…). Les noms affichés sont des copies tirées du jeton, pas une source de vérité.

### Statuts et règles

| Enum | Valeurs |
|---|---|
| `ClientFileStatus` | `PENDING` (demande) → `ACTIVE` (acceptée / affectée) ou `REJECTED` (refusée) ; `ACTIVE` → `CLOSED` |
| `AssignmentType` | `ACCEPTANCE`, `ADMIN_ASSIGNMENT`, `ADMIN_REASSIGNMENT` |
| `DocumentStatus` | `PENDING`, `VALIDATED`, `REJECTED` |
| `ValidationDecision` | `VALIDATED`, `REJECTED` |
| `DocumentSource` | `UPLOAD`, `EXTERNAL` |
| `DocumentType` | `BALANCE_SHEET`, `INCOME_STATEMENT`, `INVOICE`, `BANK_STATEMENT`, `FINANCIAL_FORECAST`, `BUDGET`, `TAX_RETURN`, `PAYROLL`, `REPORT`, `OTHER` |
| `UserRole` | `ACCOUNTANT`, `ENTREPRENEUR`, `ADMIN` |
| `DocumentEventType` | `DELETED` |

**Espaces comptables**
- Créés à la première requête d'un `ROLE_ACCOUNTANT`, avec `acceptingClients = false` : le comptable s'ouvre lui-même aux demandes.
- L'annuaire proposé aux entrepreneurs ne liste que les espaces `active && acceptingClients`.
- Un ADMIN peut désactiver un espace : les demandes `PENDING` sont **refusées automatiquement** (motif « Espace comptable désactivé »),
  les dossiers `ACTIVE` restent lisibles mais le comptable ne peut plus agir ; l'ADMIN doit les réaffecter.

**Dossiers**
- L'entrepreneur crée une demande (`PENDING`) auprès d'un comptable disponible ; une seule demande ouverte par startup et par comptable.
- Le comptable l'accepte (`ACTIVE`, ligne `ACCEPTANCE`) ou la refuse (`REJECTED`, motif obligatoire).
- L'ADMIN peut affecter directement une demande (`ACTIVE`, ligne `ADMIN_ASSIGNMENT`) ou réaffecter un dossier actif (motif obligatoire, ligne `ADMIN_REASSIGNMENT`).
- Un dossier `REJECTED` ou `CLOSED` est en lecture seule.

**Documents**
- Dépôt uniquement sur un dossier `ACTIVE`. Formats : PDF, PNG, JPG, XLSX ; **10 Mo** maximum ; le type MIME réel est vérifié (fileinfo).
- Document déposé par l'entrepreneur : `PENDING`. Document déposé par le comptable : `VALIDATED` d'office, avec une ligne de validation automatique.
- Rejet : commentaire obligatoire. Une décision peut être **révisée** (ex. `VALIDATED` → `REJECTED`), toujours avec commentaire,
  sauf si une version plus récente existe. Chaque décision ajoute une ligne d'historique.
- Nouvelle version : par l'entrepreneur, seulement si la version précédente est `REJECTED` ; `versionNumber` est incrémenté
  et `previousVersion` pointe vers l'ancienne. Les listes ne montrent que la dernière version (sauf `?includeHistory=true`).
- Suppression **logique** (`deletedAt`) : le fichier reste stocké, le document disparaît des listes, un `DocumentEvent DELETED` est tracé.
  L'entrepreneur ne supprime que ses documents `PENDING` ; le comptable ses propres documents ; dossier `ACTIVE` uniquement.
- `EXTERNAL` : seule la référence (`externalRef`, `externalService`) est stockée, aucun fichier local.

---

## 2. Installation et lancement

### Prérequis

- PHP **8.2+** avec les extensions `pdo_mysql`, `intl`, `mbstring`, `xml`, `fileinfo`, `openssl`, `sodium`, `zip`, `curl`
- Composer 2
- MySQL ou MariaDB (XAMPP convient : MariaDB 10.4)

> Sous Windows, si le PHP de XAMPP est trop ancien (8.0), installez un PHP 8.2+ séparé (ex. `C:\php84`) et gardez MariaDB de XAMPP.

### Étapes

```bash
cd Backend/Professional-Service
composer install

# 1. Créer .env.local (jamais commité) : voir la section Configuration
# 2. Base de données
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
# 3. Données de démonstration (facultatif)
php bin/console doctrine:fixtures:load --no-interaction
# 4. Lancer le serveur sur APP_PORT (8085 par défaut)
composer serve
```

Vérification : `curl http://127.0.0.1:8085/api/comptable/health` → `{"status":"UP","service":"accounting-service"}`

---

## 3. Configuration

Les valeurs par défaut sont dans `.env` (versionné, sans secret). Les valeurs propres à votre poste vont dans **`.env.local`**
(ignoré par Git). Pour les tests, utilisez **`.env.test.local`** (l'environnement de test ne lit pas `.env.local`).

### Exemple de `.env.local`

```dotenv
APP_SECRET=remplacez_par_une_chaine_aleatoire_de_32_caracteres
DATABASE_URL="mysql://root:@127.0.0.1:3306/accounting_db?serverVersion=10.4.32-MariaDB&charset=utf8mb4"
# Facultatif
APP_PORT=8085
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'
KEYCLOAK_BASE_URL=http://localhost:8180
```

Générer un secret : `php -r "echo bin2hex(random_bytes(16));"`

### Exemple de `.env.test.local`

```dotenv
DATABASE_URL="mysql://root:@127.0.0.1:3306/accounting_db?serverVersion=10.4.32-MariaDB&charset=utf8mb4"
```
(le suffixe `_test` est ajouté automatiquement : base `accounting_db_test`)

### Variables

| Variable | Défaut | Description |
|---|---|---|
| `APP_ENV` | `dev` | Environnement Symfony |
| `APP_SECRET` | *(vide)* | Secret Symfony, à définir dans `.env.local` |
| `APP_HOST` / `APP_PORT` | `127.0.0.1` / `8085` | Adresse du serveur de développement (`composer serve`) |
| `DATABASE_URL` | exemple | Connexion MySQL/MariaDB ; **indiquez `serverVersion`** |
| `CORS_ALLOW_ORIGIN` | localhost, tout port | Expression régulière des origines autorisées (Angular : `http://localhost:4200`) |
| `KEYCLOAK_BASE_URL` | `http://localhost:8180` | URL publique de Keycloak |
| `KEYCLOAK_REALM` | `launchpad` | Realm |
| `KEYCLOAK_CLIENT_ID` | `launchpad-app` | Client OIDC de l'application |
| `KEYCLOAK_ISSUER` | `${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}` | Valeur attendue du claim `iss` |
| `KEYCLOAK_AUDIENCE` | `${KEYCLOAK_CLIENT_ID}` | Valeur attendue dans le claim `aud` |
| `KEYCLOAK_USE_CLIENT_ROLES` | `false` | `true` : lit aussi `resource_access.<client_id>.roles` |
| `KEYCLOAK_ROLE_ACCOUNTANT` | `ACCOUNTANT` | Nom du rôle Keycloak → `ROLE_ACCOUNTANT` |
| `KEYCLOAK_ROLE_ENTREPRENEUR` | `ENTREPRENEUR` | Nom du rôle Keycloak → `ROLE_ENTREPRENEUR` |
| `KEYCLOAK_ROLE_ADMIN` | `ADMIN` | Nom du rôle Keycloak → `ROLE_ADMIN` |
| `EUREKA_ENABLED` | `false` | `true` : `composer serve` enregistre aussi le service dans Eureka |
| `EUREKA_SERVER_URL` | `http://localhost:8761/eureka` | URL du serveur Eureka |
| `EUREKA_APP_NAME` | `PROFESSIONAL-SERVICE` | Nom d'enregistrement (utilisé par la Gateway : `lb://PROFESSIONAL-SERVICE`) |
| `EUREKA_INSTANCE_HOST` / `EUREKA_INSTANCE_IP` | `localhost` / `127.0.0.1` | Adresse annoncée à Eureka (le port annoncé est `APP_PORT`) |
| `EUREKA_HEARTBEAT_INTERVAL` | `30` | Intervalle du battement de cœur, en secondes |
| `DOCUMENT_STORAGE_DIR` | `%kernel.project_dir%/var/uploads` | Répertoire **privé** des fichiers déposés |
| `DOCUMENT_MAX_SIZE` | `10M` | Taille maximale d'un fichier |

> `upload_max_filesize` et `post_max_size` du `php.ini` doivent être au moins égaux à `DOCUMENT_MAX_SIZE`
> (par exemple `10M` et `12M`), sinon PHP refuse le fichier avant Symfony.

---

## 4. Keycloak

### Ce que vérifie le service

Chaque requête doit porter `Authorization: Bearer <JWT>`. Le jeton est validé **localement** par le handler OIDC de Symfony :

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
# Directement sur le service
curl -H "Authorization: Bearer $TOKEN" http://localhost:8085/api/comptable/me

# Via la Gateway (adaptez le port)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/comptable/files
```

```powershell
Invoke-RestMethod -Uri "http://localhost:8085/api/comptable/me" -Headers @{ Authorization = "Bearer $TOKEN" }
```

### Utilisateurs des fixtures

Les fixtures utilisent ces `sub`. Pour tester avec les données de démonstration, créez des utilisateurs Keycloak
avec ces identifiants (import de realm), ou remplacez-les dans `src/DataFixtures/FixtureUsers.php`.

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

Les règles sont appliquées par des **Voters** Symfony (`src/Security/Voter`). Les règles d'état (statut du dossier ou du document)
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
il suffit de fournir une autre implémentation de `PaginationFormatterInterface` (`config/services.yaml`).

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
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN` | Jeton absent ; jeton invalide ou expiré |
| 403 | `FORBIDDEN` | Rôle ou droits insuffisants |
| 404 | `NOT_FOUND` | Ressource inexistante (ou document supprimé) |
| 405 / 415 | `METHOD_NOT_ALLOWED`, `UNSUPPORTED_MEDIA_TYPE` | Méthode ou type de contenu non pris en charge |
| 409 | `INVALID_STATUS`, `FILE_NOT_ACTIVE`, `FILE_CLOSED`, `DUPLICATE_FILE`, `WORKSPACE_UNAVAILABLE`, `WORKSPACE_INACTIVE`, `ALREADY_ASSIGNED`, `NEWER_VERSION_EXISTS`, `VERSIONING_NOT_ALLOWED`, `VALIDATION_NOT_APPLICABLE`, `EXTERNAL_DOCUMENT` | Action incompatible avec l'état actuel |
| 500 | `INTERNAL_ERROR` | Erreur inattendue (détail technique ajouté uniquement en `dev`) |

---

## 7. Endpoints

Tous les chemins sont préfixés par `/api/comptable`. `{id}` est un UUID.

| Méthode | Chemin | Rôle(s) | Description |
|---|---|---|---|
| GET | `/health` | public | Disponibilité du service |
| GET | `/me` | tous | Identité lue dans le jeton, rôles reconnus |
| GET | `/workspaces` | tous | Comptables disponibles (admin : `?all=true`) |
| GET | `/workspaces/me` | ACCOUNTANT | Mon espace (créé au besoin) |
| PATCH | `/workspaces/me` | ACCOUNTANT | `{ "acceptingClients": true }` |
| PATCH | `/workspaces/{id}/status` | ADMIN | `{ "active": false }` |
| GET | `/files` | tous | Dossiers visibles (`?status=`, pagination) |
| POST | `/files` | ENTREPRENEUR | Demande de dossier |
| GET | `/files/{id}` | voir | Détail d'un dossier |
| PATCH | `/files/{id}` | ENTREPRENEUR | Modifier une demande `PENDING` |
| POST | `/files/{id}/accept` | ACCOUNTANT | Accepter une demande |
| POST | `/files/{id}/reject` | ACCOUNTANT | Refuser (`reason` obligatoire) |
| POST | `/files/{id}/assign` | ADMIN | Affecter / réaffecter (`workspaceId`, `reason`) |
| POST | `/files/{id}/close` | ACCOUNTANT, ADMIN | Clôturer |
| GET | `/files/{id}/assignments` | voir | Historique d'affectation |
| GET | `/files/{id}/documents` | voir | Documents (`?includeHistory=true`, `?status=`, `?type=`) |
| POST | `/files/{id}/documents` | ENTREPRENEUR, ACCOUNTANT | Dépôt de fichier (multipart) |
| POST | `/files/{id}/documents/external` | ENTREPRENEUR | Déclarer un document externe |
| GET | `/documents/{id}` | voir | Détail d'un document |
| GET | `/documents/{id}/download` | voir | Téléchargement (droits vérifiés) |
| DELETE | `/documents/{id}` | ENTREPRENEUR, ACCOUNTANT | Suppression logique |
| POST | `/documents/{id}/versions` | ENTREPRENEUR | Nouvelle version (multipart) |
| POST | `/documents/{id}/versions/external` | ENTREPRENEUR | Nouvelle version externe |
| POST | `/documents/{id}/validate` | ACCOUNTANT | Valider (commentaire obligatoire pour une révision) |
| POST | `/documents/{id}/reject` | ACCOUNTANT | Rejeter (commentaire obligatoire) |
| GET | `/documents/{id}/validations` | voir | Historique des décisions |
| GET | `/documents/{id}/events` | voir | Historique des événements |
| GET | `/files/{id}/messages` | voir | Fil de discussion (le plus récent d'abord) |
| POST | `/files/{id}/messages` | ENTREPRENEUR, ACCOUNTANT | Envoyer un message |
| POST | `/messages/{id}/read` | destinataire | Marquer comme lu |

### Exemples

Dans les exemples, `$API=http://localhost:8085/api/comptable` et `$TOKEN` est un jeton Keycloak valide.

#### Identité courante

```bash
curl -H "Authorization: Bearer $TOKEN" $API/me
```
```json
{
  "data": {
    "id": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
    "username": "sonia",
    "email": "sonia.benammar@launchpad.tn",
    "firstName": "Sonia",
    "lastName": "Ben Ammar",
    "displayName": "Sonia Ben Ammar",
    "roles": ["ROLE_ACCOUNTANT"],
    "workspaceId": "019a03c1-5b2e-7d41-9f0a-3c5e7b9d1f20"
  }
}
```

#### Le comptable s'ouvre aux demandes

```bash
curl -X PATCH $API/workspaces/me -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"acceptingClients": true}'
```
```json
{
  "data": {
    "id": "019a03c1-5b2e-7d41-9f0a-3c5e7b9d1f20",
    "accountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
    "displayName": "Sonia Ben Ammar",
    "acceptingClients": true,
    "active": true,
    "createdAt": "2026-10-19T08:12:44+00:00",
    "updatedAt": "2026-10-19T09:03:10+00:00"
  }
}
```

#### L'entrepreneur demande un comptable

```bash
curl -X POST $API/files -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "workspaceId": "019a03c1-5b2e-7d41-9f0a-3c5e7b9d1f20",
  "startupName": "AgriSense",
  "startupId": "prj-agrisense-001",
  "requestMessage": "Nous cherchons un accompagnement pour notre premier exercice."
}'
```
Réponse `201 Created` (en-tête `Location: /api/comptable/files/{id}`) :
```json
{
  "data": {
    "id": "019a03d2-7c11-7a3e-8b54-2e6f8a0c4d12",
    "reference": "DOS-2026-000007",
    "status": "PENDING",
    "startupId": "prj-agrisense-001",
    "startupName": "AgriSense",
    "entrepreneurId": "e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a01",
    "entrepreneurDisplayName": "Amine Jaziri",
    "requestMessage": "Nous cherchons un accompagnement pour notre premier exercice.",
    "rejectionReason": null,
    "workspace": {
      "id": "019a03c1-5b2e-7d41-9f0a-3c5e7b9d1f20",
      "accountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
      "displayName": "Sonia Ben Ammar"
    },
    "decidedAt": null,
    "closedAt": null,
    "createdAt": "2026-10-19T09:15:02+00:00",
    "updatedAt": "2026-10-19T09:15:02+00:00"
  }
}
```

#### Lister ses dossiers (paginé, filtré)

```bash
curl -H "Authorization: Bearer $TOKEN" "$API/files?status=ACTIVE&page=1&limit=20"
```
```json
{
  "data": [ { "id": "…", "reference": "DOS-2026-000001", "status": "ACTIVE", "startupName": "AgriSense", "…": "…" } ],
  "meta": { "page": 1, "limit": 20, "total": 1, "pages": 1 }
}
```

#### Accepter / refuser une demande (comptable)

```bash
curl -X POST $API/files/{id}/accept -H "Authorization: Bearer $TOKEN"

curl -X POST $API/files/{id}/reject -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"reason": "Agenda complet jusqu'"'"'en janvier."}'
```

#### Réaffecter un dossier (admin)

```bash
curl -X POST $API/files/{id}/assign -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"workspaceId": "019a03c1-6d40-7b22-a1c3-4e5f6a7b8c90", "reason": "Congé de Mme Ben Ammar."}'
```

```bash
curl -H "Authorization: Bearer $TOKEN" $API/files/{id}/assignments
```
```json
{
  "data": [
    {
      "id": "019a0410-1e2f-7c3d-9a4b-5c6d7e8f9a01",
      "type": "ADMIN_REASSIGNMENT",
      "previousAccountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
      "newAccountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c02",
      "assignedBy": "ad5e1c00-3b7a-4d2f-9e8c-1a2b3c4d5e01",
      "reason": "Congé de Mme Ben Ammar.",
      "assignedAt": "2026-10-19T10:02:11+00:00"
    },
    {
      "id": "019a03d9-0a1b-7c2d-8e3f-4a5b6c7d8e90",
      "type": "ACCEPTANCE",
      "previousAccountantId": null,
      "newAccountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
      "assignedBy": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
      "reason": null,
      "assignedAt": "2026-10-19T09:20:45+00:00"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2, "pages": 1 }
}
```

#### Déposer un document (multipart)

```bash
curl -X POST $API/files/{id}/documents -H "Authorization: Bearer $TOKEN" \
  -F "file=@releve-avril-2026.pdf" \
  -F "title=Relevé bancaire — avril 2026" \
  -F "type=BANK_STATEMENT" \
  -F "periodStart=2026-04-01" \
  -F "periodEnd=2026-04-30"
```
Réponse `201 Created` :
```json
{
  "data": {
    "id": "019a0421-3f4a-7b5c-8d6e-7f8a9b0c1d23",
    "clientFileId": "019a03d2-7c11-7a3e-8b54-2e6f8a0c4d12",
    "title": "Relevé bancaire — avril 2026",
    "type": "BANK_STATEMENT",
    "source": "UPLOAD",
    "status": "PENDING",
    "versionNumber": 1,
    "previousVersionId": null,
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30",
    "file": {
      "originalFilename": "releve-avril-2026.pdf",
      "mimeType": "application/pdf",
      "size": 184213,
      "checksum": "9f2c4e…",
      "downloadUrl": "/api/comptable/documents/019a0421-3f4a-7b5c-8d6e-7f8a9b0c1d23/download"
    },
    "external": null,
    "uploadedBy": "e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a01",
    "uploadedByRole": "ENTREPRENEUR",
    "uploadedAt": "2026-10-19T10:30:00+00:00",
    "updatedAt": "2026-10-19T10:30:00+00:00"
  }
}
```

#### Déclarer un document externe

```bash
curl -X POST $API/files/{id}/documents/external -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "title": "Prévisionnel financier 2026-2028",
  "type": "FINANCIAL_FORECAST",
  "externalRef": "FIN-PREV-2026-0042",
  "externalService": "financial-service",
  "periodStart": "2026-01-01",
  "periodEnd": "2028-12-31"
}'
```
La réponse contient `"source": "EXTERNAL"`, `"file": null` et `"external": {"ref": "FIN-PREV-2026-0042", "service": "financial-service"}`.

#### Télécharger un fichier

```bash
curl -H "Authorization: Bearer $TOKEN" -OJ $API/documents/{id}/download
```
Réponse binaire avec `Content-Type`, `Content-Disposition: attachment; filename=…`, `Cache-Control: private, no-store`.

#### Valider / rejeter / réviser (comptable)

```bash
# Rejet : commentaire obligatoire
curl -X POST $API/documents/{id}/reject -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"comment": "Il manque les factures de février."}'

# Validation simple : corps facultatif
curl -X POST $API/documents/{id}/validate -H "Authorization: Bearer $TOKEN"
```
Réponse `201 Created` :
```json
{
  "data": {
    "document": { "id": "…", "status": "REJECTED", "…": "…" },
    "validation": {
      "id": "019a0430-2b3c-7d4e-9f5a-6b7c8d9e0f12",
      "decision": "REJECTED",
      "previousStatus": "PENDING",
      "revision": false,
      "automatic": false,
      "comment": "Il manque les factures de février.",
      "accountantId": "7d3c9a52-1f4e-4b8a-9c21-5e6f7a8b9c01",
      "createdAt": "2026-10-19T11:00:00+00:00"
    }
  }
}
```

#### Nouvelle version d'un document rejeté

```bash
curl -X POST $API/documents/{id}/versions -H "Authorization: Bearer $TOKEN" \
  -F "file=@factures-t1-2026-complet.pdf" -F "title=Factures fournisseurs T1 2026 (complètes)" -F "type=INVOICE"
```
La réponse contient `"versionNumber": 2` et `"previousVersionId": "{id}"`.

#### Supprimer un document (logique)

```bash
curl -X DELETE $API/documents/{id} -H "Authorization: Bearer $TOKEN"   # 204 No Content
```

#### Messages

```bash
curl -X POST $API/files/{id}/messages -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content": "J'"'"'ai déposé la version complète des factures.", "documentId": "019a0421-3f4a-7b5c-8d6e-7f8a9b0c1d23"}'
```
```json
{
  "data": {
    "id": "019a0440-4d5e-7f6a-8b7c-9d0e1f2a3b45",
    "clientFileId": "019a03d2-7c11-7a3e-8b54-2e6f8a0c4d12",
    "documentId": "019a0421-3f4a-7b5c-8d6e-7f8a9b0c1d23",
    "senderId": "e1f2a3b4-5c6d-4e7f-8a9b-0c1d2e3f4a01",
    "senderRole": "ENTREPRENEUR",
    "content": "J'ai déposé la version complète des factures.",
    "readAt": null,
    "createdAt": "2026-10-19T11:10:00+00:00"
  }
}
```

```bash
curl -X POST $API/messages/{id}/read -H "Authorization: Bearer $TOKEN"   # par le destinataire
```

#### Exemples d'erreurs

```json
// 401 : jeton absent
{ "error": { "status": 401, "code": "UNAUTHORIZED", "message": "Authentification requise : jeton d'accès manquant." } }

// 403 : un administrateur tente de valider un document
{ "error": { "status": 403, "code": "FORBIDDEN", "message": "Accès refusé." } }

// 409 : dépôt sur un dossier clôturé
{ "error": { "status": 409, "code": "FILE_NOT_ACTIVE", "message": "Cette action n'est possible que sur un dossier actif." } }
```

---

## 8. Route Spring Cloud Gateway

Dans le `application.yml` de la Gateway :

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: accounting-service
          uri: http://localhost:8085
          predicates:
            - Path=/api/comptable/**
          filters:
            # Relaie le jeton de l'utilisateur connecté (nécessite spring-boot-starter-oauth2-client)
            - TokenRelay=
```

> **Spring Cloud Gateway 4.3+ (Spring Cloud 2025)** : les propriétés ont été déplacées sous
> `spring.cloud.gateway.server.webflux.routes` (même contenu de route).

```yaml
spring:
  cloud:
    gateway:
      server:
        webflux:
          routes:
            - id: accounting-service
              uri: http://localhost:8085
              predicates:
                - Path=/api/comptable/**
              filters:
                - TokenRelay=
```

### Avec Eureka

Le service s'enregistre dans Eureka sous le nom **`PROFESSIONAL-SERVICE`**. La Gateway peut alors le joindre par son nom :

```yaml
            - id: accounting-service
              uri: lb://PROFESSIONAL-SERVICE
              predicates:
                - Path=/api/comptable/**
```

Il n'existe pas de client Eureka officiel en PHP : l'enregistrement passe par l'API REST d'Eureka
(`src/Discovery/EurekaClient.php`) et la commande `app:eureka:register` :

1. `POST /eureka/apps/PROFESSIONAL-SERVICE` au démarrage (statut `UP`, `healthCheckUrl` = `/api/comptable/health`) ;
2. `PUT .../{instanceId}` toutes les `EUREKA_HEARTBEAT_INTERVAL` secondes (si Eureka a redémarré, l'instance est réenregistrée) ;
3. `DELETE .../{instanceId}` à l'arrêt (Ctrl+C). Si le processus est tué brutalement, Eureka retire l'instance au bout de 90 s.

Lancement :

```bash
# Avec EUREKA_ENABLED=true dans .env.local : serveur + enregistrement en une commande
composer serve

# Ou séparément, dans un second terminal
php bin/console app:eureka:register
```

Si Eureka n'est pas joignable, la commande affiche une erreur et réessaie à chaque intervalle, sans arrêter le service.
Vérification : tableau de bord `http://localhost:8761`, ou
`curl -H "Accept: application/json" http://localhost:8761/eureka/apps/PROFESSIONAL-SERVICE`.

Identifiant d'instance : `localhost:professional-service:8085` (format Spring Cloud `hôte:application:port`).
En Docker, définissez `EUREKA_INSTANCE_HOST` avec le nom du conteneur, joignable par la Gateway.

Remarques :
- Aucune réécriture de chemin : le service expose déjà `/api/comptable/**`.
- Si la Gateway reçoit déjà `Authorization: Bearer …` du frontend (mode resource server), l'en-tête est transmis tel quel ;
  `TokenRelay` n'est utile que si la Gateway gère la session OAuth2 (client OAuth2).
- Si le CORS est géré par la Gateway, évitez les en-têtes en double : ajoutez
  `- DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST`
  ou restreignez `CORS_ALLOW_ORIGIN` côté service.
- En Docker, remplacez `http://localhost:8085` par le nom du service (ex. `http://accounting-service:8085`).

---

## 9. Tests

```bash
composer test
```

Ce script recrée la base `accounting_db_test`, exécute les migrations, charge les fixtures, puis lance PHPUnit
(71 tests fonctionnels et unitaires). Chaque test s'exécute dans une transaction annulée à la fin
(`dama/doctrine-test-bundle`) : les fixtures restent intactes d'un test à l'autre.

- **Aucun Keycloak réel n'est nécessaire.** Une paire de clés RSA est générée au premier lancement dans `var/test-keys`
  (non versionné). `TestTokenFactory` signe des JWT au format Keycloak. La découverte OIDC (`.well-known` puis JWKS) est servie
  par `KeycloakMockResponseFactory` via le `MockHttpClient` de Symfony : le code de validation de production est exercé tel quel.
- Simuler un utilisateur dans un test :
  ```php
  $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', "/documents/$id/validate");
  // ou un utilisateur arbitraire
  $this->withToken(TestTokenFactory::create($sub, ['ENTREPRENEUR'], ['exp' => time() - 10]));
  ```
- Relancer seulement PHPUnit (base déjà prête) : `php vendor/bin/phpunit`
- Windows : si la génération des clés échoue, définissez `OPENSSL_CONF` (par ex. `C:\php84\extras\ssl\openssl.cnf`).

---

## 10. Structure du code et choix techniques

```
src/
├── Controller/        Contrôleurs REST (Me, Workspace, ClientFile, Document, Message, Health)
├── DataFixtures/      Données de démonstration (FixtureUsers : identifiants stables)
├── Dto/               Objets d'entrée validés (MapRequestPayload + Symfony Validator)
├── Entity/            Entités Doctrine
├── Enum/              Statuts et types (enums PHP)
├── EventListener/     Gestionnaire d'erreurs JSON global, création automatique des espaces
├── Exception/         ApiException (erreurs métier → JSON)
├── Http/              ApiResponse, pagination, filtres, résolveur de documents actifs
├── Presenter/         Représentation JSON des ressources (contrat de l'API)
├── Repository/        Requêtes Doctrine
├── Security/          Utilisateur Keycloak, provider, correspondance des rôles, réponses 401, Voters
├── Service/           Règles métier (espaces, dossiers, documents, messages)
└── Storage/           DocumentStorageInterface + stockage local
```

- **Authentification remplaçable / extensible** : toute la logique Keycloak est dans `src/Security` et `config/packages/security.yaml`.
  Pour ajouter un compte de service (`client_credentials`), il suffit d'ajouter `SERVICE` à `UserRole`, un nom de rôle dans `.env`
  et les règles correspondantes dans les Voters.
- **Stockage remplaçable** : implémentez `DocumentStorageInterface` (S3, MinIO…) et changez l'alias dans `config/services.yaml`.
  Les fichiers ne sont jamais servis publiquement : seul `/documents/{id}/download` y donne accès, après contrôle des droits.
- **Versionnement** : la contrainte « une seule version suivante par document » est vérifiée dans le code et non par un index unique,
  car une version supprimée logiquement doit pouvoir être redéposée.
- **Références de dossier** : `DOS-AAAA-NNNNNN`, séquence annuelle protégée par un index unique.
- **Aucune dépendance de données** vers les autres microservices : les liens passent uniquement par des identifiants
  (`sub` Keycloak, `startupId`, `externalRef` / `externalService`).
