# Module Co-Fondateur IA

**Service backend :** AI-Service (3 microservices)
**URL :** `/co-fondateur-ia`
**Développeur :** Yassine

---

## Architecture

Ce module est découpé en **3 pages**, chacune connectée à un microservice distinct via l'API Gateway
(`http://localhost:8090/api/ai/`).

```
features/ai/
├── ai.routes.ts                    # Routes lazy du module
├── ai.component.ts                 # Composant racine (router-outlet)
├── README.md                       # Ce fichier
├── models/
│   ├── ai.models.ts                # Interfaces TypeScript (Projet, Analyse, Reco, Conversation…)
│   └── libelles.ts                 # Libellés affichés (stades, statuts, catégories, priorités)
├── services/
│   ├── projet-api.service.ts       # GET/POST /api/ai/projets/ et /api/ai/analyses/
│   ├── recommandation-api.service.ts # GET/PATCH /api/ai/recommandations/
│   └── conversation-api.service.ts # GET/POST /api/ai/conversations/ et messages
└── pages/
    ├── projet/                     # Page 1 : Mon Projet & Diagnostic
    │   ├── projet.page.ts
    │   ├── projet.page.html
    │   └── projet.page.scss
    ├── recommandations/            # Page 2 : Plan d'action & Recommandations
    │   ├── recommandations.page.ts
    │   ├── recommandations.page.html
    │   └── recommandations.page.scss
    └── chat/                       # Page 3 : Chat Co-Fondateur
        ├── chat.page.ts
        ├── chat.page.html
        └── chat.page.scss
```

---

## Pages

### Page 1 — Mon Projet & Diagnostic (`/co-fondateur-ia/projet`)

- Carte projet : titre, statut, secteur, stade, public cible, budget, objectifs
- Bouton **Activer le projet** (passe `statut` à `actif`)
- Bouton **Analyser mon projet** (appel `POST /api/ai/projets/{id}/analyser/`)
- Modale d'édition du projet
- Score global (jauge SVG 0–100) + résumé
- Colonnes Forces / Faiblesses issues de la dernière analyse

### Page 2 — Plan d'action & Recommandations (`/co-fondateur-ia/recommandations`)

- Barre de progression (nb appliquées / total)
- Filtres par catégorie : Toutes · Marché · Financier · Juridique · Produit · Équipe
- Cartes recommandation avec badge priorité + badge catégorie
- Actions : **Marquer appliquée** / **Ignorer** / **Restaurer**
- Bouton **Régénérer les recommandations** (`POST /api/ai/recommandations/generer/`)

### Page 3 — Chat Co-Fondateur (`/co-fondateur-ia/chat`)

- Panneau gauche : liste des conversations + bouton **Nouvelle conversation**
- Panneau droit : fil de messages avec bulles (utilisateur / IA)
- Indicateur de frappe animé pendant l'envoi
- Envoi par Entrée, saut de ligne par Maj+Entrée
- Responsive : panneau gauche toggle sur mobile

---

## Configuration

```
src/environments/environment.ts           → aiApiUrl: 'http://localhost:8090/api/ai'
src/environments/environment.development.ts → idem
```

> L'`entrepreneur_id` et le `projet_id` provisoires sont définis dans `environment.utilisateur`.
> Ils seront remplacés par le JWT du User-Service quand ce service sera disponible.

---

## Endpoints utilisés

| Page | Méthode | Endpoint |
|------|---------|----------|
| Projet | GET | `/api/ai/projets/{id}/` |
| Projet | PATCH | `/api/ai/projets/{id}/` |
| Projet | POST | `/api/ai/projets/{id}/activer/` |
| Projet | POST | `/api/ai/projets/{id}/analyser/` |
| Projet | GET | `/api/ai/analyses/` |
| Recommandations | GET | `/api/ai/recommandations/?projet_id={id}` |
| Recommandations | PATCH | `/api/ai/recommandations/{id}/statut/` |
| Recommandations | POST | `/api/ai/recommandations/generer/` |
| Chat | GET | `/api/ai/conversations/?projet_id={id}` |
| Chat | GET | `/api/ai/conversations/{id}/` |
| Chat | POST | `/api/ai/conversations/` |
| Chat | POST | `/api/ai/conversations/{id}/messages/` |

---

## Règles

- Tout le code du module reste dans `features/ai/`.
- N'importer que depuis `core/`, `shared/` et ce dossier.
- Les styles restent dans les composants du module. `src/styles.scss` = variables + reset uniquement.
- Variables SCSS : `@use '../../../../../styles/variables' as *;`
