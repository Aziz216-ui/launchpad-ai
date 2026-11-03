# Module Juridique

**Service backend :** Legal-Service
**URL :** `/juridique`

Ce dossier appartient au membre qui développe le module « Juridique ». Il porte le nom du service
backend ; l'URL et les libellés visibles restent en français. Pour l'instant, la route `/juridique`
affiche la page provisoire `legal-en-cours.page.ts`.

## Quoi mettre ici

```
features/legal/
├── legal.routes.ts   # routes du module (déjà branché dans app.routes.ts)
├── README.md        # description du module (ce fichier, à compléter)
├── models/          # interfaces TypeScript des réponses de votre API
├── services/        # appels HTTP à votre microservice
├── pages/           # un composant par écran
└── components/      # composants propres à vos écrans (cartes, graphiques, modales…)
```

1. Remplacer la page provisoire dans `legal.routes.ts` par vos pages, puis supprimer
   `legal-en-cours.page.ts`.
2. Renseigner l'URL de votre API dans `src/environments/environment.ts` **et**
   `environment.development.ts` (clé `legalApiUrl`), puis l'utiliser dans votre service :
   `private readonly url = environment.legalApiUrl;`
3. Vérifier que votre microservice autorise l'origine `http://localhost:4200` (CORS).

## Règles

- Tout le code du module reste dans ce dossier.
- N'importer que depuis `core/`, `shared/` et ce dossier : **jamais** depuis le dossier d'un
  autre module, et ne jamais modifier le dossier d'un autre membre.
- Les styles du module restent dans ses composants ; `src/styles.scss` ne contient que les
  variables et le reset. Les couleurs de la charte sont disponibles via `@use 'variables' as *;`.
- Disponible dans `shared/` : badge, modale de confirmation, état vide, loader, toasts, icônes.
  Dans `core/` : `NotificationService` (toasts) et l'intercepteur HTTP (erreurs, futur JWT).
