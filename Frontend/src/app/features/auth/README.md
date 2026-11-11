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

## Écrans

| URL | Écran |
|---|---|
| `/connexion/login` | Connexion (`login.component.ts`) |
| `/connexion/register` | Inscription (`register.component.ts`) |
| `/connexion/mot-de-passe-oublie` | Mot de passe oublié (`mot-de-passe-oublie.page.ts`) |

- **Afficher / masquer le mot de passe** : `champ-mot-de-passe.component.ts` (à utiliser avec
  `ngModel` à la place d'un `<input type="password">`). Bouton « œil » `type="button"` (n'envoie
  pas le formulaire, activable au clavier), `aria-label` « Afficher / Masquer le mot de passe »
  et `aria-pressed`.
- **Mot de passe oublié**, en 2 étapes sur la même page (routes publiques du User-Service) :
  1. `POST /api/auth/forgot-password/ {identifiant}` (e-mail ou nom d'utilisateur) : code à
     6 chiffres envoyé par e-mail, valable 10 minutes (une nouvelle demande annule l'ancien code).
     Toujours le même message : « Si un compte existe, un code a été envoyé. ». Au plus
     3 demandes par e-mail et par 15 minutes ; « Renvoyer le code » est désactivé 60 secondes.
  2. `POST /api/auth/reset-password/ {identifiant, code, nouveau_mot_de_passe}` : au plus 5 essais
     par code, mot de passe d'au moins 8 caractères avec une majuscule, un chiffre et un caractère
     spécial. Erreurs en français (`error`) avec `code_erreur` : `code_invalide`, `code_expire`,
     `trop_essais`, `mot_de_passe_faible`, `champs_invalides`. Succès : retour à
     `/connexion/login?motDePasseModifie=1` (message de confirmation).
  E-mails : SMTP configuré par les variables `EMAIL_*` du `.env` racine (ex. Gmail) ; sans
  `EMAIL_HOST`, ils arrivent dans Mailpit : http://localhost:8025

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
