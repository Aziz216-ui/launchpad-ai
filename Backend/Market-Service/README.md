# Market-Service — LaunchPad AI

Microservice Django chargé d'**analyser le marché et les concurrents** d'un projet.
Il est appelé en REST par le **AI-Service** pour récupérer les données de marché.

Les utilisateurs et les projets appartiennent à d'autres microservices : on ne stocke ici
que l'identifiant du projet (`projet_id`), **sans clé étrangère**.

| Élément | Valeur |
|---|---|
| Port | **8005** |
| Préfixe API | `/api/market/` |
| Swagger UI | http://localhost:8005/api/market/docs/ |
| Schéma OpenAPI | http://localhost:8005/api/market/schema/ |
| Admin Django | http://localhost:8005/admin/ |

**Stack :** Python 3.11+, Django 5, Django REST Framework, PostgreSQL, django-cors-headers,
drf-spectacular, python-dotenv, Gunicorn et WhiteNoise (pour Docker).

---

## Structure

```
Market-Service/
├── config/                 # projet Django (settings, urls)
├── marche/                 # application métier
│   ├── models.py           # Secteur, Concurrent, EtudeMarche, Tendance
│   ├── serializers.py
│   ├── services.py         # logique d'analyse (secteur, projet, niveau de concurrence)
│   ├── views.py            # ViewSets CRUD + vues d'analyse + health
│   ├── urls.py
│   ├── admin.py
│   ├── tests.py
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
| `EtudeMarche` | `projet_id` (entier, pas de FK), `secteur` (FK), `titre`, `taille_marche`, `taux_croissance` (%), `cible`, `zone_geographique`, `date_creation`, `date_mise_a_jour` |
| `Tendance` | `titre`, `secteur` (FK), `description`, `impact` (`positif` / `negatif` / `neutre`), `date_creation` |

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

## Endpoints

### CRUD (ModelViewSet)

| Ressource | URL | Filtres / recherche |
|---|---|---|
| Secteurs | `/api/market/secteurs/` | `?search=<nom>` |
| Concurrents | `/api/market/concurrents/` | `?secteur=<id>`, `?pays=<pays>`, `?search=<nom>`, `?ordering=-part_de_marche` |
| Études de marché | `/api/market/etudes/` | `?projet_id=<id>` |
| Tendances | `/api/market/tendances/` | `?secteur=<id>`, `?impact=positif\|negatif\|neutre` |

Chaque ressource supporte : `GET` (liste), `POST` (création), `GET /<id>/`,
`PUT /<id>/`, `PATCH /<id>/`, `DELETE /<id>/`.

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
python manage.py seed_marche          # 3 secteurs, 10 concurrents, 4 études, 7 tendances
python manage.py seed_marche --reset  # vide les données du marché puis réinsère
```

La commande peut être relancée sans créer de doublons. Les études sont rattachées aux
projets `1`, `2` et `3`.

## Tests

```bash
python manage.py test
```

22 tests (`APITestCase`) : CRUD complet des concurrents (dont validations, filtres et format
numérique), analyse de secteur, analyse de projet (y compris projet sans étude), règles du
niveau de concurrence, health check, seed et documentation Swagger.
