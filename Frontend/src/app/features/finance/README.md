# Module Finance

**Service backend :** Finance-Service (`/api/finance`)

## Écrans

| Route | Écran | Scénarios backend |
|---|---|---|
| `/finance/apercu` | Chiffres clés, marges, projections, écart et commentaire IA | 1, 2, IA |
| `/finance/previsions` | Liste et création des prévisions | 1 |
| `/finance/projections` | Génération des projections pluriannuelles | 2 |
| `/finance/documents` | Génération (avec analyse IA optionnelle), consultation, export PDF / Excel, suppression | 3, 4 |
| `/finance/assistant` | Assistant financier IA (outils : marges, génération de document) | IA |

## Organisation

```
features/finance/
├── finance.component.ts/.scss   # enveloppe : en-tête, projet courant, onglets, styles (préfixés .finance)
├── finance.routes.ts            # routes lazy du module
├── models/                      # interfaces des réponses de l'API, libellés
├── services/                    # FinanceApiService (HTTP), FinanceStore (projet et prévisions), erreurs
├── pipes/                       # montant, taux
├── components/                  # graphique des projections (SVG)
└── pages/                       # un composant par écran
```

## Brancher le backend

- `environment.financeApiUrl` vaut `http://localhost:8090/api/finance` : comme le module Marché, Finance passe
  par l'API Gateway, qui gère le CORS (origine `http://localhost:4200`) et répartit les appels :
  documents, liste des documents et notifications vers le Document-Service (port 8083), le reste vers le
  Prevision-Service (port 8081).
- Pour tester en local : Eureka (8761), Prevision-Service, Document-Service, API Gateway (8090), puis `ng serve`.
  PostgreSQL (bases `prevision_db` et `document_db`) et RabbitMQ doivent être démarrés.
- Le projet courant est un **UUID** (les services Finance référencent le projet par identifiant uniquement).
  Il est conservé dans le navigateur ; le bouton « Nouveau projet » en génère un autre.
  À remplacer par le projet de l'utilisateur connecté quand le User-Service sera disponible.
- Les fonctions IA répondent 503 tant que le backend n'a pas de clé (`SPRING_AI_MODEL_CHAT=openai`, `XAI_API_KEY`).

## Règles

- Tout le code du module reste dans ce dossier ; imports uniquement depuis `core/`, `shared/` et ce dossier.
- Les montants s'affichent en TND (`DEVISE` dans `models/libelles.ts`).
