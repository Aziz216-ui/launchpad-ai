# LaunchPad — Microservice « Gestion Juridique » (Legal Service)

Microservice backend NestJS / TypeScript dédié à la **génération, gestion, révision et signature de documents juridiques** (Statuts constitutifs, Contrats de prestation, Accords de confidentialité NDA, Procès-verbaux d'Assemblée) au sein de la plateforme **LaunchPad**.

---

## 🛠 Stack Technique & Conventions

- **Framework** : [NestJS](https://nestjs.com/) v11 avec TypeScript en mode strict (`strict: true`)
- **Préfixe global REST** : `/api/v1/juridique`
- **Base de données** : PostgreSQL avec [TypeORM](https://typeorm.io/)
- **Configuration** : `@nestjs/config` avec validation et fichier `.env` / `.env.example`
- **Validation** : `class-validator` & `class-transformer` avec `ValidationPipe` global (`whitelist: true`)
- **Documentation OpenAPI / Swagger** : Accessible sur `/api/docs`
- **Architecture d'accès** : API REST ouverte (les vérifications d'authentification et de permissions peuvent être gérées en amont par l'API Gateway ou le Service Utilisateurs)
- **Événements de domaine** : `@nestjs/event-emitter` (`document.validation.requested`, `document.status.changed`, `document.signature.requested`, `document.signed`, `document.archived`, etc.)
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

## 📡 Matrice Complète des Endpoints

Tous les endpoints sont préfixés par `/api/v1/juridique`.

### 1. Gestion des documents

| Méthode | Endpoint | Description | Service / Méthode |
|---|---|---|---|
| `POST` | `/documents/generate` | Génère un document avec clauses types (`STATUTS`, `CONTRAT`, `NDA`, `PV`) | `GenerateurJuridiqueService.generer` |
| `GET` | `/documents` | Liste les documents avec filtres optionnels (`projetId`, `type`, `statut`) | `GestionnaireDocsJuridiquesService.list` |
| `GET` | `/documents/{id}` | Consulter un document avec ses clauses et commentaires | `GestionnaireDocsJuridiquesService.findById` |
| `PATCH` | `/documents/{id}` | Modifier titre ou paramètres (incrémente `version`) | `GestionnaireDocsJuridiquesService.modifierDocument` |
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
- **Swagger UI** : [http://localhost:3003/api/docs](http://localhost:3003/api/docs)
- **Préfixe API** : [http://localhost:3003/api/v1/juridique](http://localhost:3003/api/v1/juridique)

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
