# LaunchPad — Microservice « Gestion Juridique » (Legal Service)

Microservice backend NestJS / TypeScript dédié à la **génération, gestion, révision et signature de documents juridiques** (Statuts constitutifs, Contrats de prestation, Accords de confidentialité NDA, Procès-verbaux d'Assemblée) au sein de la plateforme **LaunchPad**.

---

## 🛠 Stack Technique & Conventions

- **Framework** : [NestJS](https://nestjs.com/) v11 avec TypeScript en mode strict (`strict: true`)
- **Préfixe global REST** : `/api/legal` (conforme au routage API Gateway)
- **Port** : `3003`
- **Nom Eureka** : `LEGAL-SERVICE`
- **Base de données** : PostgreSQL avec [TypeORM](https://typeorm.io/)
- **Configuration** : `@nestjs/config` avec validation et fichier `.env` / `.env.example`
- **Validation** : `class-validator` & `class-transformer` avec `ValidationPipe` global (`whitelist: true`)
- **Documentation OpenAPI / Swagger** : Accessible sur `/api/docs`
- **CORS** : Géré par l'API Gateway en amont (désactivé au niveau du microservice)
- **Événements de domaine** : `@nestjs/event-emitter` (`document.validation.requested`, `document.status.changed`, `document.signature.requested`, `document.signed`, `document.archived`, etc.), relayés sur RabbitMQ (voir ci-dessous)
- **Messagerie asynchrone** : RabbitMQ (`amqplib` + `amqp-connection-manager`), exchange topic `launchpad.events`
- **Génération & Export PDF** : `pdfkit` avec streaming de fichiers et mise en page soignée
- **Conteneurisation** : `Dockerfile` multi-stage et `docker-compose.yml` (service + PostgreSQL)
- **Tests** : Suite de tests unitaires [Jest](https://jestjs.io/) vérifiant notamment la machine à états et les règles de conflit

---

## 🏛 Architecture & Modules

```
Legal-Service/
├── src/
│   ├── common/                           # Enums, Filtres globaux & Événements
│   │   ├── enums/
│   │   │   ├── document-statut.enum.ts   # BROUILLON, EN_VALIDATION, VALIDE, REFUSE, SIGNE
│   │   │   └── document-type.enum.ts     # STATUTS, CONTRAT, NDA, PV
│   │   ├── events/
│   │   │   └── document.events.ts        # Classes et constantes d'événements EventEmitter
│   │   └── filters/
│   │       └── http-exception.filter.ts  # Format d'erreur uniforme { statusCode, timestamp, path, message, error }
│   ├── config/
│   │   └── database.config.ts            # Configuration TypeORM PostgreSQL
│   ├── database/
│   │   └── entities/
│   │       ├── clause.entity.ts
│   │       ├── commentaire.entity.ts
│   │       └── document-juridique.entity.ts
│   ├── documents/                        # 3.2 Gestion des documents
│   │   ├── controllers/
│   │   │   └── documents.controller.ts
│   │   ├── dto/
│   │   │   ├── changer-statut.dto.ts
│   │   │   ├── demander-signature.dto.ts
│   │   │   ├── filter-documents.dto.ts
│   │   │   ├── generate-document.dto.ts
│   │   │   ├── modifier-clause.dto.ts
│   │   │   ├── modifier-document.dto.ts
│   │   │   └── validation-request.dto.ts
│   │   ├── services/
│   │   │   ├── generateur-juridique.service.ts
│   │   │   ├── gestionnaire-docs-juridiques.service.ts
│   │   │   └── workflow-signature.service.ts
│   │   └── documents.module.ts
│   ├── verification/                     # 3.3 Vérification par avocat
│   │   ├── controllers/
│   │   │   └── verification.controller.ts
│   │   ├── dto/
│   │   │   ├── ajouter-commentaire.dto.ts
│   │   │   ├── demander-informations.dto.ts
│   │   │   ├── refuser-document.dto.ts
│   │   │   └── signer-document.dto.ts
│   │   ├── services/
│   │   │   └── verification-avocat.service.ts
│   │   └── verification.module.ts
│   ├── app.module.ts
│   ├── main.ts
│   └── seed.ts                           # Données initiales de test
├── requests.http                         # Collection HTTP complète de test
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 🔄 Machine à États & Règles Métier

### Transitions d'état autorisées
```
[BROUILLON]
     │
     ▼ (envoyerPourValidation / changerStatut)
[EN_VALIDATION]
     │
     ├───► [VALIDE] ───► [SIGNE] (demande de signature / signature avocat)
     │
     └───► [REFUSE] (motif obligatoire)
```

- **Règle 409 Conflict** : Toute transition non autorisée (ex: `BROUILLON` vers `VALIDE`, `EN_VALIDATION` vers `SIGNE`, ou transition depuis `SIGNE`/`REFUSE`) retourne immédiatement un code HTTP **409 Conflict**.
- **Refus justifié** : Le passage à `REFUSE` exige obligatoirement un `motif` (rejet sans motif = `400 Bad Request`).
- **Signature restreinte** : La signature (`signer`, `demanderSignature`) est permise **uniquement** sur un document au statut `VALIDE`.
- **Incrémentation de version** : Chaque modification des informations générales d'un document ou d'une de ses clauses incrémente automatiquement le champ `version`.
- **Archivage** : Un document archivé (`isArchived: true`) est en **lecture seule stricte**. Toute tentative d'amendement, modification de clause, ou changement de statut renvoie un code HTTP **409 Conflict**.
- **Événements émis** :
  - `document.validation.requested`
  - `document.status.changed`
  - `document.signature.requested`
  - `document.signed`
  - `document.info.requested`
  - `document.archived`

---

## 🐇 Messagerie RabbitMQ

Les trois microservices (Legal, Clause, Commentaire) partagent l'exchange topic `launchpad.events`.
Les lectures et les créations qui doivent renvoyer un résultat restent en HTTP synchrone.

| Publié par | Clé de routage | Consommé par (file) | Effet |
|---|---|---|---|
| Legal-Service | `document.*` (tous les `DOCUMENT_EVENTS`) | — | Diffusion des événements de domaine |
| Legal-Service | `document.deleted` | `clause-service.document-deleted`, `commentaire-service.document-deleted` | Suppression des clauses / commentaires du document |
| Clause-Service | `clause.created`, `clause.modified`, `clause.deleted` | `legal-service.events` | Journalisé par le Legal-Service |
| Commentaire-Service | `commentaire.created`, `commentaire.deleted` | `legal-service.events` | Journalisé par le Legal-Service |

- Démarrer le broker : `docker compose -f ../RabbitMQ/docker-compose.yml up -d` (interface : http://localhost:15672, `guest` / `guest`)
- Variables : `RABBITMQ_ENABLED`, `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`
- Si le broker est arrêté, les services démarrent quand même et se reconnectent seuls ; les messages publiés entre-temps sont envoyés à la reconnexion.
- Un message dont le traitement échoue est déplacé dans la file `<file>.dlq`.

---

## 📡 Matrice Complète des Endpoints

Tous les endpoints sont préfixés par `/api/legal`.

### 1. Gestion des documents

| Méthode | Endpoint | Description | Service / Méthode |
|---|---|---|---|
| `POST` | `/documents/generate` | Génère un document avec clauses types (`STATUTS`, `CONTRAT`, `NDA`, `PV`) | `GenerateurJuridiqueService.generer` |
| `GET` | `/documents` | Liste les documents avec filtres optionnels (`projetId`, `type`, `statut`) | `GestionnaireDocsJuridiquesService.list` |
| `GET` | `/documents/{id}` | Consulter un document avec ses clauses et commentaires | `GestionnaireDocsJuridiquesService.findById` |
| `PATCH` | `/documents/{id}` | Modifier titre ou paramètres (incrémente `version`) | `GestionnaireDocsJuridiquesService.modifierDocument` |
| `DELETE` | `/documents/{id}` | Supprimer un document (refusé si archivé ou signé) ; clauses et commentaires supprimés via RabbitMQ | `GestionnaireDocsJuridiquesService.supprimer` |
| `GET` | `/documents/{id}/export?format=pdf` | Exporter et télécharger le document mis en page en PDF | `GestionnaireDocsJuridiquesService.exporterPDF` |
| `POST` | `/documents/{id}/archive` | Archiver le document (bascule en lecture seule) | `GestionnaireDocsJuridiquesService.archiver` |
| `POST` | `/documents/{id}/validation-requests` | Soumettre le document à vérification avocat (`BROUILLON` -> `EN_VALIDATION`) | `GestionnaireDocsJuridiquesService.envoyerPourValidation` |
| `POST` | `/documents/{id}/status` | Changer le statut via la machine à états | `GestionnaireDocsJuridiquesService.changerStatut` |
| `GET` | `/documents/{id}/clauses` | Lister les clauses ordonnées par numéro | `GestionnaireDocsJuridiquesService.getClauses` |
| `PATCH` | `/documents/{id}/clauses/{numero}` | Modifier une clause (incrémente `version` du document) | `GestionnaireDocsJuridiquesService.modifierClause` |
| `POST` | `/documents/{id}/signatures` | Demander la signature (document `VALIDE` requis) | `WorkflowSignatureService.demanderSignature` |
| `GET` | `/documents/{id}/signatures/status` | Consulter l'état des signatures du document | `WorkflowSignatureService.getStatutSignature` |
| `GET` | `/documents/{id}/comments` | Lister tous les commentaires d'un document | `GestionnaireDocsJuridiquesService.getCommentaires` |

### 2. Vérification par avocat

| Méthode | Endpoint | Description | Service / Méthode |
|---|---|---|---|
| `GET` | `/verification/documents/{id}` | Consulter le document pour audit légal | `VerificationAvocatService.consulterDocument` |
| `PATCH` | `/verification/documents/{id}/clauses/{numero}` | Modifier une clause légale (incrémente `version`) | `VerificationAvocatService.modifierClause` |
| `POST` | `/verification/documents/{id}/comments` | Ajouter une remarque juridique au dossier | `VerificationAvocatService.ajouterCommentaire` |
| `POST` | `/verification/documents/{id}/accept` | Valider le document (`EN_VALIDATION` -> `VALIDE`) | `VerificationAvocatService.accepter` |
| `POST` | `/verification/documents/{id}/reject` | Refuser le document avec motif obligatoire | `VerificationAvocatService.refuser` |
| `POST` | `/verification/documents/{id}/info-requests` | Demander des précisions ou justificatifs au client | `VerificationAvocatService.demanderInformations` |
| `POST` | `/verification/documents/{id}/sign` | Apposer la signature officielle de l'avocat (`VALIDE` -> `SIGNE`) | `VerificationAvocatService.signer` |

---

## 🚀 Installation & Démarrage

### Prérequis
- Node.js >= 20.x
- PostgreSQL local ou Docker

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration de l'environnement
Copiez le fichier `.env.example` vers `.env` :
```bash
cp .env.example .env
```
Paramétrez vos variables de connexion PostgreSQL dans `.env` :
```env
PORT=3003
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=legal_db
DB_SYNCHRONIZE=true
```

### 3. Démarrage de l'application

```bash
# Mode développement avec rechargement à chaud
npm run start:dev

# Mode production
npm run build
npm run start:prod
```

L'application écoute sur le port `3003`.
- **Swagger UI** : [http://localhost:3003/api/legal/docs](http://localhost:3003/api/legal/docs)
- **OpenAPI JSON Spec** : [http://localhost:3003/api/legal/docs-json](http://localhost:3003/api/legal/docs-json)
- **Via Gateway** : [http://localhost:<GATEWAY_PORT>/docs/legal](http://localhost:<GATEWAY_PORT>/docs/legal)
- **Préfixe API** : [http://localhost:3003/api/legal](http://localhost:3003/api/legal)

---

## 🐳 Déploiement avec Docker & Docker Compose

Pour lancer le service et sa base PostgreSQL en une seule commande :

```bash
docker-compose up --build
```

---

## 🌱 Données Initiales (Seed)

Alimenter la base de données avec des documents de démonstration :

```bash
npm run seed
```

---

## 🧪 Tests Unitaires

```bash
npm test
```
