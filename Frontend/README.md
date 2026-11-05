# LaunchPad AI — Frontend (Angular)

Interface web de LaunchPad AI, **partagée par tout le groupe** : chaque membre développe son
module dans son propre dossier `src/app/features/<module>/`.

Les dossiers portent le **nom du service backend** (`market` pour le Market-Service…) ; les URL
et les libellés visibles par l'utilisateur restent **en français**.

| Module | Dossier | URL | Service backend | État |
|---|---|---|---|---|
| Étude de marché | `features/market/` | `/etude-marche` | Market-Service | Fonctionnel |
| Co-Fondateur IA | `features/ai/` | `/co-fondateur-ia` | AI-Service | En cours de développement |
| Finance | `features/finance/` | `/finance` | Finance-Service | En cours de développement |
| Juridique | `features/legal/` | `/juridique` | Legal-Service | En cours de développement |
| Comptabilité | `features/professional/` | `/professional/comptabilite` | Professional-Service | En cours de développement |
| Avocat | `features/professional/` | `/professional/avocat` | Professional-Service | En cours de développement |
| Authentification | `features/auth/` | `/connexion` | User-Service | En cours de développement |
| Tableau de bord | `features/tableau-de-bord/` | `/tableau-de-bord` | à préciser (lien de la maquette, non attribué) | En cours de développement |

**Stack :** Angular 22 (composants standalone, signals, sans zone.js), Angular Router
(chargement à la demande), HttpClient, Reactive Forms, SCSS, police Poppins. Aucune librairie UI.

---

## Prérequis

- **Node.js 22.22+ ou 24.15+ (LTS)**, versions exigées par Angular 22 (`^22.22.3 || ^24.15.0 || >=26`).
  Une version impaire comme Node 25 fonctionne mais affiche un avertissement à chaque commande.
- npm 10 ou plus
- Les microservices des modules que vous testez. Pour l'Étude de marché :

```bash
cd Backend/Market-Service
docker compose up -d
docker compose exec market-service python manage.py seed_marche   # données de démonstration
```

## Installation et lancement

```bash
cd Frontend
npm install
npm start            # = ng serve, puis ouvrir http://localhost:4200
```

| Commande | Rôle |
|---|---|
| `npm start` | Serveur de développement avec rechargement automatique (port 4200) |
| `npm run build` | Build de production dans `dist/launchpad-ai-frontend/` |
| `npm run watch` | Build de développement en continu |

---

## Organisation du code

```
src/
├── environments/              # une URL par microservice (chaque membre remplit la sienne)
├── styles/_variables.scss     # PARTAGÉ : couleurs, rayons, police de la charte
├── styles.scss                # PARTAGÉ : variables CSS et reset uniquement
└── app/
    ├── app.routes.ts          # PARTAGÉ : une route lazy par module
    ├── app.config.ts          # PARTAGÉ : HttpClient + intercepteur, locale fr
    ├── core/                  # PARTAGÉ, minimal
    │   ├── http/              #   intercepteur HTTP (erreurs, futur token JWT) + ApiError
    │   ├── notifications/     #   NotificationService (toasts)
    │   └── auth/              #   TokenService (stockage du futur JWT)
    ├── layout/                # PARTAGÉ
    │   ├── menu.ts            #   liste des modules de la barre latérale (une ligne par module)
    │   ├── app-layout.component.ts, sidebar.component.*, header.component.ts
    ├── shared/components/     # PARTAGÉ : composants génériques uniquement
    │                          #   badge, confirm-modal, empty-state, loader, toast-container, icon
    └── features/              # UN DOSSIER PAR SERVICE BACKEND
        ├── market/            #   Market-Service       → /etude-marche
        ├── ai/                #   AI-Service           → /co-fondateur-ia
        ├── finance/           #   Finance-Service      → /finance
        ├── legal/             #   Legal-Service        → /juridique
        ├── professional/      #   Professional-Service → /professional/comptabilite, /professional/avocat
        ├── auth/              #   User-Service         → /connexion
        └── tableau-de-bord/   #   non attribué         → /tableau-de-bord
```

Chaque module a son propre `README.md` qui décrit son contenu.

### Ce que fournissent les parties partagées

- **`core/`** : l'intercepteur ajoute le futur token JWT et transforme les erreurs HTTP en
  `ApiError` (`statut`, `message`, `erreursChamps` pour les erreurs 400 de Django REST Framework).
  Il affiche lui-même un toast pour les erreurs réseau et serveur (5xx). `NotificationService`
  affiche des toasts : `succes()`, `erreur()`, `info()`.
- **`shared/components/`** : `app-badge`, `app-confirm-modal` (« Supprimer … ? »),
  `app-empty-state`, `app-loader`, `app-icon` (icônes SVG des maquettes). Les toasts s'affichent
  tout seuls via `app-toast-container` (déjà placé dans `app.ts`).
- **Charte graphique** : en SCSS `@use 'variables' as *;` (ex. `$primaire`, `$texte`, `$police`),
  ou en CSS `var(--lp-primaire)`.
- **Recherche de l'en-tête** : elle ajoute `?q=<texte>` à l'URL de la page courante. Un module
  peut lire ce paramètre (ex. la liste des études de marché filtre par titre) ou l'ignorer.

---

## Règles pour travailler à plusieurs sans conflit

1. **On ne modifie pas le dossier d'un autre membre.** Tout votre code (models, services, pages,
   composants, styles) reste dans `features/<votre-module>/`.
2. Un module n'importe que depuis **`core/`**, **`shared/`** et **son propre dossier**, jamais
   depuis `features/<autre-module>/`.
3. Les composants propres à vos écrans restent dans `features/<module>/components/`. On n'ajoute
   dans `shared/` que des composants vraiment génériques, après accord du groupe.
4. Les styles de vos écrans restent dans vos composants. `src/styles.scss` ne contient que les
   variables et le reset : n'y ajoutez pas de classes.
5. Dans les fichiers partagés (`app.routes.ts`, `layout/menu.ts`, `environment*.ts`), chacun
   modifie **uniquement sa ligne**.

---

## Ajouter mon module (étape par étape)

Exemple avec le module **Finance** (remplacer `finance` / `Finance` par votre module).

### 1. Le dossier du module : `src/app/features/finance/`

Il existe déjà avec `finance.routes.ts`, une page provisoire `finance-en-cours.page.ts` et un
`README.md`. Créez-y votre code :

```
features/finance/
├── finance.routes.ts      # vos routes
├── README.md              # décrivez votre module (écrans, service, choix)
├── models/                # interfaces des réponses de votre API
├── services/              # appels HTTP à votre microservice
├── pages/                 # un composant par écran
└── components/            # composants propres à vos écrans
```

Dans `finance.routes.ts`, remplacez la page provisoire par vos pages, puis supprimez
`finance-en-cours.page.ts` :

```ts
export default [
  { path: '', loadComponent: () => import('./pages/budget.page').then((m) => m.BudgetPage) },
  { path: ':id', loadComponent: () => import('./pages/detail.page').then((m) => m.DetailPage) },
] satisfies Routes;
```

Pour un module **nouveau** (sans dossier), créez `features/<module>/` avec le même contenu.

### 2. La route lazy : `src/app/app.routes.ts`

Une ligne par module, déjà présente pour les modules existants. Le `path` est l'URL en
français, l'import pointe vers le dossier nommé d'après le service :

```ts
{ path: 'finance', loadChildren: () => import('./features/finance/finance.routes') },
{ path: 'juridique', loadChildren: () => import('./features/legal/legal.routes') },
```

### 3. Le lien de la barre latérale : `src/app/layout/menu.ts`

Une ligne par module (l'icône doit exister dans `shared/components/icon.component.ts`) :

```ts
{ libelle: 'Finance', route: '/finance', icone: 'carte' },
```

### 4. L'URL de l'API : `src/environments/environment.ts` et `environment.development.ts`

Renseignez la clé de votre service dans **les deux fichiers** :

```ts
financeApiUrl: 'http://localhost:8003/api/finance',
```

puis utilisez-la dans votre service :

```ts
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.financeApiUrl;
}
```

Clés disponibles : `marketApiUrl`, `aiApiUrl`, `financeApiUrl`, `legalApiUrl`,
`professionalApiUrl`, `userApiUrl`. Quand l'API Gateway sera en place, seules ces URL changeront.
Votre microservice doit autoriser l'origine `http://localhost:4200` (CORS).

### 5. Vérifier

```bash
npm run build      # doit passer sans erreur
npm start          # puis ouvrir http://localhost:4200/finance
```

---

## Conventions

- Composants **standalone**, état local en **signals**, `ChangeDetectionStrategy.OnPush`.
- Textes de l'interface en français.
- Ne jamais inventer une donnée absente de l'API : masquer l'élément de la maquette concerné.
- `environment.utilisateur` (projet 1, entrepreneur 101) est provisoire : il sera remplacé par le
  token JWT du User-Service.
