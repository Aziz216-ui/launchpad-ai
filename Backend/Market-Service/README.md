# Market-Service — LaunchPad AI

Microservice Django de **gestion de l'étude de marché** des projets LaunchPad AI.
Il permet à l'**entrepreneur** de comprendre son marché, d'étudier la concurrence et
d'évaluer le potentiel commercial de son projet (personas, comparaison des prix, SWOT,
rapport JSON/PDF). Il est aussi appelé en REST par le **AI-Service** pour récupérer les
données de marché.

Les utilisateurs et les projets appartiennent à d'autres microservices : on ne stocke ici
que leurs identifiants (`projet_id`, `entrepreneur_id`), **sans clé étrangère**.

| Élément | Valeur |
|---|---|
| Port | **8005** |
| Préfixe API | `/api/market/` |
| Swagger UI | http://localhost:8005/api/market/docs/ |
| Schéma OpenAPI | http://localhost:8005/api/market/schema/ |
| Admin Django | http://localhost:8005/admin/ |

**Stack :** Python 3.11+, Django 5, Django REST Framework, PostgreSQL, django-cors-headers,
drf-spectacular, python-dotenv, reportlab (rapport PDF), py-eureka-client (enregistrement
Eureka), Gunicorn et WhiteNoise (pour Docker).

---

## Structure

```
Market-Service/
├── config/                 # projet Django (settings, urls)
├── marche/                 # application métier
│   ├── models.py           # Secteur, Concurrent, EtudeMarche, Tendance, Persona, ElementSWOT
│   ├── serializers.py
│   ├── services/           # logique métier (les vues ne font qu'appeler ces fonctions)
│   │   ├── analyse.py      # analyses secteur / projet, niveau de concurrence
│   │   ├── etude.py        # comparaison des prix, opportunités/menaces, SWOT, rapport
│   │   └── rapport_pdf.py  # mise en forme PDF du rapport (reportlab)
│   ├── views.py            # ViewSets CRUD + actions d'étude + vues d'analyse + health
│   ├── urls.py
│   ├── admin.py            # Persona et ElementSWOT en inline dans EtudeMarche
│   ├── apps.py             # MarcheConfig.ready() : lance l'enregistrement Eureka
│   ├── eureka.py           # enregistrement dans Eureka (py-eureka-client)
│   ├── tests.py            # tests d'origine (CRUD concurrents, analyses, Swagger)
│   ├── tests_etude.py      # tests de l'étude de marché
│   ├── tests_eureka.py     # tests de l'enregistrement Eureka (sans serveur réel)
│   └── management/commands/seed_marche.py
├── Dockerfile
├── docker-compose.yml      # compose LOCAL (service + PostgreSQL 16)
├── requirements.txt
└── .env.example
```

## Modèles

| Modèle | Champs principaux |
|---|---|
| `Secteur` | `nom` (unique), `description`, `date_creation` |
| `Concurrent` | `nom`, `secteur` (FK), `site_web`, `description`, `forces`, `faiblesses`, `prix_moyen` (≥ 0), `part_de_marche` (0–100 %), `pays`, `date_creation` |
| `EtudeMarche` | `projet_id` (entier, pas de FK), `entrepreneur_id` (entier, pas de FK, nullable), `statut` (`brouillon` / `finalisee`), `secteur` (FK), `titre`, `taille_marche`, `taux_croissance` (%), `cible`, `zone_geographique`, `hypotheses`, `description_offre`, `prix_propose` (≥ 0, nullable), `concurrents` (M2M), `tendances` (M2M), `date_creation`, `date_mise_a_jour` |
| `Tendance` | `titre`, `secteur` (FK), `description`, `impact` (`positif` / `negatif` / `neutre`), `date_creation` |
| `Persona` | `etude` (FK, `related_name="personas"`), `nom`, `tranche_age`, `profession`, `localisation`, `revenu_estime` (≥ 0), `besoins`, `frustrations`, `comportement_achat`, `date_creation` |
| `ElementSWOT` | `etude` (FK, `related_name="swot"`), `type` (`force` / `faiblesse` / `opportunite` / `menace`), `description`, `genere_automatiquement`, `date_creation` |

Le marché cible d'une étude est décrit par `secteur`, `cible`, `zone_geographique`,
`taille_marche` et `taux_croissance`. Les `concurrents` et `tendances` d'une étude sont ceux
retenus **pour cette étude** : c'est sur eux que portent la comparaison des prix, les
opportunités/menaces, la SWOT et le rapport.

---

## Cahier des charges → endpoints

| Fonctionnalité | Endpoint(s) |
|---|---|
| Créer une étude de marché | `POST /api/market/etudes/` |
| Définir le marché cible | `POST` / `PATCH /api/market/etudes/<id>/` (`secteur`, `cible`, `zone_geographique`, `taille_marche`, `taux_croissance`) |
| Analyser les tendances | `/api/market/tendances/` + champ `tendances` (IDs) de l'étude ; `GET /api/market/analyse/secteur/<id>/` |
| Identifier les concurrents | `/api/market/concurrents/` + champ `concurrents` (IDs) de l'étude |
| Comparer les offres et les prix | `GET /api/market/etudes/<id>/comparaison-prix/` |
| Définir les personas | CRUD `/api/market/personas/` (`?etude=<id>`) |
| Évaluer opportunités et menaces | `GET /api/market/etudes/<id>/opportunites-menaces/` |
| Générer une analyse SWOT | `POST /api/market/etudes/<id>/generer-swot/` ; saisie manuelle : CRUD `/api/market/swot/` |
| Générer un rapport d'étude de marché | `GET /api/market/etudes/<id>/rapport/` (JSON) et `/rapport/pdf/` (PDF) |
| Consulter les résultats et rapports | `GET /api/market/etudes/<id>/` (détail complet), `/rapport/`, `/rapport/pdf/` |
| Modifier critères, marché cible, hypothèses | `PATCH /api/market/etudes/<id>/` |
| Finaliser une étude | `POST /api/market/etudes/<id>/finaliser/` |
| Supprimer une étude ou un brouillon | `DELETE /api/market/etudes/<id>/` (supprime aussi ses personas et sa SWOT) |
| Lister les études d'un entrepreneur | `GET /api/market/etudes/?entrepreneur_id=<id>&statut=brouillon` |

---

## Installation locale (sans Docker)

Prérequis : Python 3.11+ et un serveur PostgreSQL.

```bash
cd Backend/Market-Service

# 1. Environnement virtuel
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux / macOS

# 2. Dépendances
pip install -r requirements.txt

# 3. Configuration
copy .env.example .env         # Windows  (cp .env.example .env sous Linux/macOS)
# -> adapter DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
```

Créer la base dans PostgreSQL (une seule fois) :

```sql
CREATE USER market_user WITH PASSWORD 'market_password' CREATEDB;
CREATE DATABASE market_db OWNER market_user;
```

> `CREATEDB` est nécessaire pour que `manage.py test` puisse créer la base de test.

```bash
# 4. Migrations, données de test, superutilisateur
python manage.py migrate
python manage.py seed_marche
python manage.py createsuperuser   # optionnel, pour /admin/

# 5. Lancement sur le port 8005
python manage.py runserver 8005
```

> **Astuce :** pour lancer les tests sans PostgreSQL, ajouter `DB_ENGINE=sqlite` dans le `.env`
> (ou dans l'environnement). PostgreSQL reste la base de référence.

---

## Avec Docker (service seul)

Le `docker-compose.yml` de ce dossier lance le service **et** une base PostgreSQL 16
(avec volume persistant `market_db_data`). Les migrations sont exécutées automatiquement
au démarrage du conteneur.

```bash
cd Backend/Market-Service
copy .env.example .env               # si ce n'est pas déjà fait
docker compose up --build -d

# Données de test
docker compose exec market-service python manage.py seed_marche

# Tests (sur PostgreSQL)
docker compose exec market-service python manage.py test

# Superutilisateur pour l'admin
docker compose exec market-service python manage.py createsuperuser

# Arrêt (ajouter -v pour supprimer aussi les données)
docker compose down
```

PostgreSQL est exposé sur le port **5433** de la machine (pour ne pas entrer en conflit
avec un PostgreSQL local sur 5432).

---

## Intégration au docker-compose.yml de la racine

⚠️ Ce fichier est partagé par le groupe : **ce bloc est à ajouter manuellement** dans
`launchpad-ai/docker-compose.yml` (sections `services:` et `volumes:`).

```yaml
services:
  # ... autres services du groupe ...

  market-db:
    image: postgres:16
    container_name: market-db
    environment:
      POSTGRES_DB: market_db
      POSTGRES_USER: market_user
      POSTGRES_PASSWORD: market_password
    volumes:
      - market_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U market_user -d market_db"]
      interval: 5s
      timeout: 5s
      retries: 10

  market-service:
    build: ./Backend/Market-Service
    container_name: market-service
    environment:
      SECRET_KEY: changez-moi-en-production
      DEBUG: "False"
      ALLOWED_HOSTS: localhost,127.0.0.1,market-service
      DB_NAME: market_db
      DB_USER: market_user
      DB_PASSWORD: market_password
      DB_HOST: market-db
      DB_PORT: "5432"
    ports:
      - "8005:8005"
    depends_on:
      market-db:
        condition: service_healthy

volumes:
  # ... autres volumes ...
  market_db_data:
```

Depuis un autre conteneur (ex. AI-Service), le service est joignable à l'adresse
`http://market-service:8005/api/market/`.

---

## Eureka (découverte de services)

Le service s'enregistre dans le serveur Eureka du projet (`Backend/Eureka`, port **8761**,
URL `http://localhost:8761/eureka/`) sous le nom **`MARKET-SERVICE`**, port **8005**.
L'enregistrement est **désactivé par défaut**.

| Variable (`.env`) | Défaut | Rôle |
|---|---|---|
| `EUREKA_ENABLED` | `false` | `true` pour s'enregistrer au démarrage |
| `EUREKA_SERVER_URL` | `http://localhost:8761/eureka/` | URL du serveur Eureka |
| `EUREKA_INSTANCE_HOST` | `localhost` | Adresse annoncée aux autres services |

Fonctionnement (`marche/eureka.py`, appelé par `MarcheConfig.ready()`) :
- enregistrement **une seule fois**, uniquement quand Django sert des requêtes
  (`runserver` ou `gunicorn`) : jamais pendant `migrate`, `test`, `seed_marche`, `shell`... ;
- health check annoncé : `http://<EUREKA_INSTANCE_HOST>:8005/api/market/health/`
  (page de statut : `/api/market/docs/`) ;
- **si Eureka est injoignable**, un avertissement est loggé et le service démarre quand même.
  L'enregistrement est retenté à chaque heartbeat (30 s) : il suffit de lancer Eureka ensuite ;
- à l'arrêt du serveur (`docker stop`, Ctrl+C), le service se désenregistre
  (`DELETE /eureka/apps/MARKET-SERVICE/localhost:market-service:8005`). Après un arrêt brutal,
  Eureka retire l'instance seul, faute de heartbeat (bail de 90 s).

Dans Docker, gunicorn est lancé avec `--preload` : Django est chargé une seule fois dans le
processus maître, qui fait l'enregistrement (sans cette option, chacun des 3 workers
s'enregistrerait). Il est lancé avec `exec` pour recevoir le SIGTERM de `docker stop` et se
désenregistrer avant de s'arrêter.

> **Windows, hors Docker :** si l'avertissement indique `FileNotFoundError`, vérifier la
> variable d'environnement `SSL_CERT_FILE` : si elle pointe vers un fichier qui n'existe pas,
> httpx (utilisé par py-eureka-client) ne peut pas créer sa connexion.

### Lancer avec Eureka

```bash
# 1. Serveur Eureka (machine hôte)
cd Backend/Eureka
mvnw spring-boot:run          # Windows ; ./mvnw spring-boot:run sous Linux/macOS

# 2. Dans Backend/Market-Service/.env
EUREKA_ENABLED=true

# 3a. Sans Docker
python manage.py runserver 8005

# 3b. Ou avec Docker (recréer le conteneur pour relire le .env)
docker compose up -d --build --force-recreate market-service
docker compose logs market-service    # "Enregistré dans Eureka (...) sous MARKET-SERVICE."
```

Ouvrir http://localhost:8761 : `MARKET-SERVICE` apparaît dans « Instances currently registered
with Eureka », statut **UP** (instance `localhost:market-service:8005`).

**Dans Docker**, Eureka tourne sur la machine hôte : `docker-compose.yml` remplace
`EUREKA_SERVER_URL` par `http://host.docker.internal:8761/eureka/` et garde
`EUREKA_INSTANCE_HOST=localhost`, puisque le port 8005 est publié sur la machine
(`extra_hosts` rend `host.docker.internal` disponible aussi sous Linux). Le `.env` ne sert
qu'à activer Eureka (`EUREKA_ENABLED`). Quand Eureka sera lancé dans le même réseau Docker
que les services, il suffira de remplacer ces deux valeurs (ex. `http://eureka:8761/eureka/`
et `market-service`).

---

## Endpoints

### CRUD (ModelViewSet)

| Ressource | URL | Filtres / recherche |
|---|---|---|
| Secteurs | `/api/market/secteurs/` | `?search=<nom>` |
| Concurrents | `/api/market/concurrents/` | `?secteur=<id>`, `?pays=<pays>`, `?search=<nom>`, `?ordering=-part_de_marche` |
| Études de marché | `/api/market/etudes/` | `?projet_id=<id>`, `?entrepreneur_id=<id>`, `?statut=brouillon\|finalisee`, `?search=<titre>` |
| Tendances | `/api/market/tendances/` | `?secteur=<id>`, `?impact=positif\|negatif\|neutre` |
| Personas | `/api/market/personas/` | `?etude=<id>`, `?search=<nom>` |
| Éléments SWOT | `/api/market/swot/` | `?etude=<id>`, `?type=force\|faiblesse\|opportunite\|menace` |

Chaque ressource supporte : `GET` (liste), `POST` (création), `GET /<id>/`,
`PUT /<id>/`, `PATCH /<id>/`, `DELETE /<id>/`.

Particularités des études :
- `concurrents` et `tendances` s'écrivent et se lisent sous forme de **listes d'IDs** ;
- le détail `GET /etudes/<id>/` ajoute `concurrents_details`, `tendances_details`,
  `personas` et `swot` ;
- `statut` est en lecture seule : il passe à `finalisee` via `/finaliser/`.

Un élément SWOT créé via `/swot/` est toujours une saisie manuelle (`genere_automatiquement = false`).

### Actions sur une étude

| Méthode | URL | Description |
|---|---|---|
| POST | `/api/market/etudes/<id>/finaliser/` | Passe le statut à `finalisee` (idempotent) |
| GET | `/api/market/etudes/<id>/comparaison-prix/` | Prix proposé vs concurrents de l'étude : min / moyen / max, écart en % avec la moyenne, positionnement, concurrents triés par prix |
| GET | `/api/market/etudes/<id>/opportunites-menaces/` | Opportunités et menaces calculées (tendances, concurrence, croissance, prix) |
| POST | `/api/market/etudes/<id>/generer-swot/` | (Re)génère la SWOT par règles ; **conserve les éléments saisis à la main** |
| GET | `/api/market/etudes/<id>/rapport/` | Rapport complet en JSON |
| GET | `/api/market/etudes/<id>/rapport/pdf/` | Même rapport en PDF (`application/pdf`) |

### Analyses

| Méthode | URL | Description |
|---|---|---|
| GET | `/api/market/analyse/secteur/<secteur_id>/` | Nombre de concurrents, prix moyen, part de marché totale, top 3, tendances +/−, niveau de concurrence |
| GET | `/api/market/analyse/projet/<projet_id>/` | Études du projet, secteurs, concurrents, tendances et niveau de concurrence (toujours 200, voir ci-dessous) |
| GET | `/api/market/health/` | `{"status": "UP", "service": "market-service"}` |

### Calcul du niveau de concurrence (`marche/services.py`)

| Niveau | Règle (par secteur) |
|---|---|
| `eleve` | ≥ 6 concurrents **ou** part de marché cumulée ≥ 60 % |
| `moyen` | ≥ 3 concurrents **ou** part cumulée ≥ 30 % |
| `faible` | sinon |
| `inconnu` | projet sans aucune étude de marché (impossible d'évaluer) |

Pour un projet couvrant plusieurs secteurs, le niveau global est **le plus élevé** de ses secteurs.

### Règles de l'étude de marché (`marche/services/etude.py`)

**Positionnement prix** (prix proposé vs prix moyen des concurrents de l'étude) :

| Positionnement | Règle |
|---|---|
| `economique` | écart < -10 % |
| `aligne` | -10 % ≤ écart ≤ +10 % |
| `premium` | écart > +10 % |
| `inconnu` | pas de prix proposé ou aucun concurrent associé |

**Niveau de concurrence d'une étude** : mêmes seuils que ci-dessus, calculés sur les
concurrents **associés à l'étude** (`inconnu` s'il n'y en a aucun).

**Opportunités / menaces :**

| Source | Opportunité | Menace |
|---|---|---|
| Tendances de l'étude | impact `positif` | impact `negatif` |
| Concurrence | niveau `faible` | niveau `eleve` |
| Croissance | taux > 10 %/an | taux < 0 |
| Prix | positionnement `economique` | positionnement `premium` |

**SWOT générée** (`POST /generer-swot/`) :
- Forces : prix économique ou aligné, personas définis ;
- Faiblesses : prix premium, aucun prix proposé, aucun persona (« Cible clients non définie »),
  offre non décrite, aucun concurrent identifié ;
- Opportunités / menaces : celles du tableau ci-dessus, hors prix (déjà compté en force/faiblesse).

Seuls les éléments `genere_automatiquement = true` sont remplacés à chaque génération.
Si une étude n'a aucun élément SWOT enregistré, le rapport la calcule à la volée
(`swot.source = "calculee"`) sans rien enregistrer.

**Potentiel commercial** (score sur 7) :

| Critère | Points |
|---|---|
| Croissance | > 10 % : +2 · > 0 : +1 · < 0 : -1 |
| Concurrence | faible : +2 · moyen : +1 · élevé : -1 |
| Prix | économique ou aligné : +1 |
| Tendances | plus de positives : +1 · plus de négatives : -1 |
| Personas | au moins un : +1 |

Score ≥ 5 → `fort` · score ≥ 2 → `moyen` · sinon `faible`.

### Projet sans étude de marché

Un projet sans étude **n'est pas une erreur** : `/api/market/analyse/projet/<projet_id>/`
renvoie `200` avec la même structure que d'habitude, mais vide :

```json
{
  "projet_id": 999,
  "nombre_etudes": 0,
  "etudes": [],
  "secteurs": [],
  "concurrents": [],
  "tendances": [],
  "niveau_concurrence": "inconnu"
}
```

Le AI-Service peut donc appeler cet endpoint pour chaque projet et lire toujours les mêmes clés.
`concurrents` et `tendances` regroupent ceux de tous les secteurs du projet ; le détail par
secteur reste disponible dans `secteurs[]`.

### Format des nombres

Toute l'API (CRUD et analyses) renvoie les décimaux en **nombres JSON** (ex. `18.75`,
et non `"18.75"`), grâce à `COERCE_DECIMAL_TO_STRING = False` dans `config/settings.py`.
En écriture, on peut envoyer indifféremment `18.75` ou `"18.75"`.

---

## Exemples de requêtes

```bash
# Health check
curl http://localhost:8005/api/market/health/

# Créer un secteur
curl -X POST http://localhost:8005/api/market/secteurs/ \
  -H "Content-Type: application/json" \
  -d '{"nom": "AgriTech", "description": "Technologies agricoles"}'

# Créer un concurrent
curl -X POST http://localhost:8005/api/market/concurrents/ \
  -H "Content-Type: application/json" \
  -d '{"nom": "Konnect", "secteur": 1, "pays": "Tunisie", "prix_moyen": "25.00", "part_de_marche": "12.50"}'

# Concurrents tunisiens du secteur 1 dont le nom contient "fl"
curl "http://localhost:8005/api/market/concurrents/?secteur=1&pays=Tunisie&search=fl"

# Modifier la part de marché d'un concurrent
curl -X PATCH http://localhost:8005/api/market/concurrents/1/ \
  -H "Content-Type: application/json" -d '{"part_de_marche": "20.00"}'

# Créer une étude de marché pour le projet 1
curl -X POST http://localhost:8005/api/market/etudes/ \
  -H "Content-Type: application/json" \
  -d '{"projet_id": 1, "secteur": 1, "titre": "Paiement mobile", "taille_marche": "450000000", "taux_croissance": "12.5", "zone_geographique": "Tunisie"}'

# Études d'un projet / tendances positives d'un secteur
curl "http://localhost:8005/api/market/etudes/?projet_id=1"
curl "http://localhost:8005/api/market/tendances/?secteur=1&impact=positif"

# Analyses
curl http://localhost:8005/api/market/analyse/secteur/1/
curl http://localhost:8005/api/market/analyse/projet/1/

# Étude de marché d'un entrepreneur : création avec concurrents et tendances (IDs)
curl -X POST http://localhost:8005/api/market/etudes/ \
  -H "Content-Type: application/json" \
  -d '{"projet_id": 7, "entrepreneur_id": 42, "secteur": 1, "titre": "Caisse mobile", "cible": "Commerçants", "taux_croissance": "12", "description_offre": "Encaissement par QR code", "prix_propose": "15", "concurrents": [1, 2, 4], "tendances": [1, 2]}'

# Ajouter un persona à l'étude 5, puis générer la SWOT et le rapport
curl -X POST http://localhost:8005/api/market/personas/ \
  -H "Content-Type: application/json" \
  -d '{"etude": 5, "nom": "Sami, épicier", "tranche_age": "35-50 ans", "besoins": "Encaisser sans espèces"}'
curl -X POST http://localhost:8005/api/market/etudes/5/generer-swot/
curl http://localhost:8005/api/market/etudes/5/comparaison-prix/
curl http://localhost:8005/api/market/etudes/5/rapport/
curl -o rapport.pdf http://localhost:8005/api/market/etudes/5/rapport/pdf/
curl -X POST http://localhost:8005/api/market/etudes/5/finaliser/
```

Exemple de réponse de `/api/market/analyse/secteur/1/` (après `seed_marche`) :

```json
{
  "secteur": {"id": 1, "nom": "FinTech"},
  "nombre_concurrents": 4,
  "prix_moyen": 18.75,
  "part_de_marche_totale": 63.0,
  "top_concurrents": [
    {"id": 3, "nom": "Stripe", "pays": "États-Unis", "prix_moyen": 30.0, "part_de_marche": 25.0},
    {"id": 1, "nom": "Flouci", "pays": "Tunisie", "prix_moyen": 0.0, "part_de_marche": 18.0},
    {"id": 2, "nom": "Konnect", "pays": "Tunisie", "prix_moyen": 25.0, "part_de_marche": 12.0}
  ],
  "tendances_positives": 1,
  "tendances_negatives": 1,
  "niveau_concurrence": "eleve"
}
```

Une requête invalide (ex. `part_de_marche` à 120 ou `prix_moyen` négatif) renvoie `400 Bad Request`
avec le détail de l'erreur.

---

## Données de test

```bash
python manage.py seed_marche          # 3 secteurs, 10 concurrents, 4 études, 7 tendances, 3 personas
python manage.py seed_marche --reset  # vide les données du marché puis réinsère
```

La commande peut être relancée sans créer de doublons. Les études sont rattachées aux
projets `1`, `2` et `3`. Deux études sont **complètes** (entrepreneur, offre, hypothèses,
concurrents, tendances, personas et SWOT générée) :

| Étude | Entrepreneur | Statut | Positionnement prix | Potentiel |
|---|---|---|---|---|
| Paiement mobile pour PME (projet 1) | 101 | `finalisee` | économique (-20 %) | moyen (3/7) |
| Plateforme de soutien scolaire (projet 2) | 102 | `brouillon` | aligné (-5,26 %) | fort (5/7) |

Une étude déjà complétée n'est pas réécrite lors d'une nouvelle exécution.

## Tests

```bash
python manage.py test
```

70 tests :
- `tests.py` (22) : CRUD complet des concurrents (dont validations, filtres et format
  numérique), analyse de secteur, analyse de projet (y compris projet sans étude), règles du
  niveau de concurrence, health check, seed et documentation Swagger ;
- `tests_etude.py` (33) : CRUD des études (nouveaux champs, M2M, filtres, compatibilité avec
  l'ancien format), CRUD personas et SWOT, finaliser, comparaison des prix, opportunités/menaces,
  génération de la SWOT (éléments manuels conservés), rapport JSON et PDF, seed et Swagger ;
- `tests_eureka.py` (15) : enregistrement Eureka simulé (paramètres envoyés, une seule fois,
  désactivé par défaut, jamais pendant `migrate`/`test`, démarrage malgré un Eureka injoignable,
  désenregistrement à l'arrêt par le seul processus maître).

```bash
# Sans PostgreSQL (SQLite)
DB_ENGINE=sqlite python manage.py test             # Linux / macOS / Git Bash
# $env:DB_ENGINE="sqlite"; python manage.py test   # PowerShell
```
