# Module Professional (Comptabilité et Avocat)

**Service backend :** Professional-Service
**URL :** `/professional/comptabilite` et `/professional/avocat`

Ce dossier regroupe les deux écrans servis par le Professional-Service : « Comptabilité » et
« Avocat ». Il porte le nom du service backend ; les libellés visibles restent en français.
Les anciennes URL `/comptabilite` et `/avocat` redirigent vers les nouvelles.

## Comptabilité (branchée sur l'espace comptable, via l'API Gateway `/api/comptable`)

```
features/professional/
├── professional.routes.ts                     # comptabilite, comptabilite/comptables, avocat
├── models/comptabilite.models.ts              # contrat JSON (dossiers, espaces comptables)
├── services/comptabilite-api.service.ts       # appels HTTP (environment.professionalApiUrl)
├── components/demande-comptable-modal.component.ts  # formulaire de demande (POST /files)
└── pages/
    ├── _commun.scss                           # mise en page partagée des pages
    ├── comptabilite/                          # /professional/comptabilite : dossiers, onglets, compteurs
    └── comptables/                            # /professional/comptabilite/comptables : annuaire (ENTREPRENEUR)
```

- **Comptabilité** : dossiers de l'utilisateur (`GET /files`), filtrés par statut, avec les compteurs par
  statut et la pagination. Le bouton « Demander un comptable » (entrepreneur) ouvre l'annuaire.
- **Demander un comptable** : une carte par comptable disponible (`GET /workspaces`). « Demander » ouvre
  le formulaire (nom de la startup, identifiant du projet, message) qui crée la demande (`POST /files`,
  statut `PENDING`).
- Un comptable apparaît dans l'annuaire dès son inscription : User-Service publie l'événement
  `workspace.accountant_registered`, workspace-service crée son espace (voir le README du Professional-Service, §12).
- Comptes de démo : `adem` / `Adem@2026!` (entrepreneur), `nadia` et `walid` / `Comptable@2026!` (comptables).

L'écran « Avocat » est servi par `features/lawyer-space` (LawyerSpaceComponent).

## Règles

- Tout le code du module reste dans ce dossier.
- N'importer que depuis `core/`, `shared/` et ce dossier : **jamais** depuis le dossier d'un
  autre module, et ne jamais modifier le dossier d'un autre membre.
- Les styles du module restent dans ses composants ; `src/styles.scss` ne contient que les
  variables et le reset. Les couleurs de la charte sont disponibles via `@use 'variables' as *;`.
- Disponible dans `shared/` : badge, modale de confirmation, état vide, loader, toasts, icônes.
  Dans `core/` : `NotificationService` (toasts) et l'intercepteur HTTP (erreurs, futur JWT).
