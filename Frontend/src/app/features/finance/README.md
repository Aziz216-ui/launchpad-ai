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

- `environment.financeApiUrl` vaut `/api/finance` (chemin relatif).
- En développement, `ng serve` redirige `/api/finance` vers le Prevision-Service (`http://localhost:8081`) et les
  routes documents / notifications vers le Document-Service (`http://localhost:8082`) grâce à `proxy.conf.json`.
  Pas de CORS à configurer.
  Pour passer par l'API Gateway (qui répartit entre les deux services) : ne garder qu'une entrée `/api/finance`
  avec `http://localhost:8090` comme `target`.
- Le projet courant est un **UUID** (les services Finance référencent le projet par identifiant uniquement).
  Il est conservé dans le navigateur ; le bouton « Nouveau projet » en génère un autre.
  À remplacer par le projet de l'utilisateur connecté quand le User-Service sera disponible.
- Les fonctions IA répondent 503 tant que le backend n'a pas de clé (`SPRING_AI_MODEL_CHAT=openai`, `XAI_API_KEY`).

## Règles

- Tout le code du module reste dans ce dossier ; imports uniquement depuis `core/`, `shared/` et ce dossier.
- Les montants s'affichent en TND (`DEVISE` dans `models/libelles.ts`).
