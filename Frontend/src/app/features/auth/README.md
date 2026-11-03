# Module Authentification

**Service backend :** User-Service
**URL :** `/connexion`

Ce dossier appartient au membre qui développe le module « Authentification ». Il porte le nom du service
backend ; l'URL et les libellés visibles restent en français. Pour l'instant, la route `/connexion`
affiche la page provisoire `auth-en-cours.page.ts`.

## Quoi mettre ici

```
features/auth/
├── auth.routes.ts   # routes du module (déjà branché dans app.routes.ts)
├── README.md        # description du module (ce fichier, à compléter)
├── models/          # interfaces TypeScript des réponses de votre API
├── services/        # appels HTTP à votre microservice
├── pages/           # un composant par écran
└── components/      # composants propres à vos écrans (cartes, graphiques, modales…)
```

1. Remplacer la page provisoire dans `auth.routes.ts` par vos pages, puis supprimer
   `auth-en-cours.page.ts`.
2. Renseigner l'URL de votre API dans `src/environments/environment.ts` **et**
   `environment.development.ts` (clé `userApiUrl`), puis l'utiliser dans votre service :
   `private readonly url = environment.userApiUrl;`
3. Vérifier que votre microservice autorise l'origine `http://localhost:4200` (CORS).

## Points propres à ce module

- Le stockage du token JWT est déjà prévu dans `core/auth/token.service.ts`, et l'intercepteur
  `core/http/api.interceptor.ts` ajoute l'en-tête `Authorization` dès qu'un token existe : après
  la connexion, ce module n'a qu'à appeler `TokenService.enregistrer(token)`.
- `environment.utilisateur` (projet 1, entrepreneur 101) est provisoire : il sera remplacé par
  les informations du token JWT.
- La page `/connexion` est pour l'instant affichée dans le layout (barre latérale). Une page de
  connexion sans barre latérale se déclare au même niveau que `AppLayoutComponent` dans
  `app.routes.ts` (modification à convenir avec le groupe).

## Règles

- Tout le code du module reste dans ce dossier.
- N'importer que depuis `core/`, `shared/` et ce dossier : **jamais** depuis le dossier d'un
  autre module, et ne jamais modifier le dossier d'un autre membre.
- Les styles du module restent dans ses composants ; `src/styles.scss` ne contient que les
  variables et le reset. Les couleurs de la charte sont disponibles via `@use 'variables' as *;`.
- Disponible dans `shared/` : badge, modale de confirmation, état vide, loader, toasts, icônes.
  Dans `core/` : `NotificationService` (toasts) et l'intercepteur HTTP (erreurs, futur JWT).
