# Module Professional (Comptabilité et Avocat)

**Service backend :** Professional-Service
**URL :** `/professional/comptabilite` et `/professional/avocat`

Ce dossier regroupe les deux écrans servis par le Professional-Service : « Comptabilité » et
« Avocat ». Il porte le nom du service backend ; les libellés visibles restent en français.
Les anciennes URL `/comptabilite` et `/avocat` redirigent vers les nouvelles.
Pour l'instant, chaque sous-route affiche une page provisoire.

## Quoi mettre ici

```
features/professional/
├── professional.routes.ts          # routes du module : comptabilite/ et avocat/
├── README.md                       # description du module (ce fichier, à compléter)
├── comptabilite-en-cours.page.ts   # page provisoire de /professional/comptabilite
├── avocat-en-cours.page.ts         # page provisoire de /professional/avocat
├── models/                         # interfaces TypeScript des réponses de l'API
├── services/                       # appels HTTP au Professional-Service (partagés par les 2 écrans)
├── pages/
│   ├── comptabilite/               # écrans Comptabilité
│   └── avocat/                     # écrans Avocat
└── components/                     # composants propres aux écrans du module
```

1. Remplacer les pages provisoires dans `professional.routes.ts` par vos pages (en gardant les
   chemins `comptabilite` et `avocat`, utilisés par `layout/menu.ts`), puis supprimer
   `comptabilite-en-cours.page.ts` et `avocat-en-cours.page.ts`.
2. Renseigner l'URL de l'API dans `src/environments/environment.ts` **et**
   `environment.development.ts` (clé `professionalApiUrl`), puis l'utiliser dans votre service :
   `private readonly url = environment.professionalApiUrl;`
3. Vérifier que le microservice autorise l'origine `http://localhost:4200` (CORS).

## Règles

- Tout le code du module reste dans ce dossier.
- N'importer que depuis `core/`, `shared/` et ce dossier : **jamais** depuis le dossier d'un
  autre module, et ne jamais modifier le dossier d'un autre membre.
- Les styles du module restent dans ses composants ; `src/styles.scss` ne contient que les
  variables et le reset. Les couleurs de la charte sont disponibles via `@use 'variables' as *;`.
- Disponible dans `shared/` : badge, modale de confirmation, état vide, loader, toasts, icônes.
  Dans `core/` : `NotificationService` (toasts) et l'intercepteur HTTP (erreurs, futur JWT).
