# Module Étude de marché

**Service backend :** Market-Service (Django REST, `environment.marketApiUrl`,
par défaut `http://localhost:8005/api/market`).
**Utilisateur :** l'entrepreneur, qui étudie son marché, sa concurrence et le potentiel
commercial de son projet.

Tout le code du module est dans ce dossier (`features/market/`, du nom du service backend).
Il n'importe que depuis `core/`, `shared/` et ce dossier. Les URL restent en français
(`/etude-marche/...`).

## Écrans

| URL | Écran |
|---|---|
| `/etude-marche` | Liste des études : filtres par statut, tri, recherche (`?q=`), suppression, état vide |
| `/etude-marche/nouvelle` | Création en 3 étapes (marché cible, offre, hypothèses), brouillon enregistré à chaque étape |
| `/etude-marche/:id/modifier` | Modification (`?etape=2` ou `?etape=3` ouvre directement une étape) |
| `/etude-marche/:id/apercu` | Indicateurs, potentiel commercial (jauge), opportunité, hypothèses à valider |
| `/etude-marche/:id/concurrents` | Associer, créer, modifier, retirer ou supprimer des concurrents |
| `/etude-marche/:id/tendances` | Tendances associées et balance des impacts |
| `/etude-marche/:id/prix` | Comparaison du prix proposé avec les concurrents |
| `/etude-marche/:id/personas` | Personas (ajout et modification en modale) |
| `/etude-marche/:id/swot` | SWOT : génération automatique et éléments ajoutés à la main |
| `/etude-marche/:id/rapport` | Rapport complet et téléchargement du PDF |

## Organisation

```
market/
├── market.routes.ts            # routes lazy du module (sous /etude-marche)
├── market.component.ts         # racine du module : <router-outlet> + styles communs du module
├── market.component.scss       # styles communs (.page, .carte, .kpi, .btn-primaire…), préfixés .market
├── market.config.ts            # réglages du module (devise affichée)
├── models/
│   ├── market.models.ts        # interfaces écrites d'après le schéma OpenAPI du Market-Service
│   └── libelles.ts             # libellés et couleurs des statuts, niveaux, impacts, SWOT
├── services/
│   ├── market-api.service.ts   # appels REST au Market-Service
│   └── etude-store.service.ts  # état de l'étude ouverte, partagé par l'en-tête et les onglets
├── pages/
│   ├── liste/                  # Liste.dc.html, Liste-vide.dc.html
│   ├── formulaire/             # Creation.dc.html
│   └── detail/                 # page détail + 7 onglets (Apercu, Concurrents, Tendances, Prix,
│                               # Personas, SWOT, Rapport)
├── components/                 # en-tête d'étude, onglets, modales (persona, concurrent, tendance,
│                               # élément SWOT), modale générique, menu « ⋮ », erreur de champ
├── pipes/                      # montant, pourcentage, initiales, lignes
└── utils/                      # formats français, validateurs, erreurs 400 sous les champs
```

## Styles

`market.component.ts` n'est pas encapsulé : ses styles sont partagés par toutes les pages
du module, mais chaque règle est préfixée par `.market` (la classe de ce composant). Ils ne
s'appliquent donc jamais aux autres modules, et ne sont chargés qu'à l'ouverture du module.
Les styles propres à un écran restent dans le `.scss` de sa page ou de son composant.
Les couleurs viennent de `src/styles/_variables.scss` (`@use 'variables' as *;`).

## Données provisoires

- `environment.utilisateur` (projet 1, entrepreneur 101) remplit `projet_id` et `entrepreneur_id`
  à la création, en attendant le token JWT du User-Service. La liste affiche toutes les études
  tant qu'il n'y a pas d'authentification.
- Le Market-Service ne fournit pas de devise : elle est réglée dans `market.config.ts`.

## Éléments des maquettes absents de l'API

Masqués ou remplacés : nom et avatar de l'utilisateur, nom du projet, description courte de
l'étude (remplacée par la cible), gamme des concurrents (« Essentiel »…), mention « HT / mois »,
catégorie et horizon des tendances, cartes de conseil rédigées à la main (« Votre angle de
différenciation », « Votre priorité », « Accessible, sans compromis », « Ce qui rassemble vos
personas »), points clés de l'offre, étiquette de source des éléments SWOT enregistrés, nombre de
pages du rapport. Le potentiel commercial est un score sur 7 (et non sur 100).

## Tester

Démarrer le Market-Service (`docker compose up -d` dans `Backend/Market-Service`, puis
`python manage.py seed_marche` dans le conteneur), lancer `npm start` dans `Frontend/`, puis ouvrir
http://localhost:4200/etude-marche et l'étude 1 (« Paiement mobile pour PME »).
