# Co-Fondateur IA — Microservice AI-Service

Microservice **Co-Fondateur IA** du monorepo Launchpad-AI.
Il accompagne l'entrepreneur dans la structuration de son projet et fournit des recommandations personnalisees via un moteur de regles (sans cle API) ou un LLM (optionnel).

---

## Fonctionnalites du cahier des charges vs Endpoints

| Fonctionnalite | Endpoint |
|---|---|
| Creer un projet entrepreneurial | `POST /api/ai/projets/` |
| Decrire son idee et ses objectifs | `PATCH /api/ai/projets/<id>/` |
| Activer un projet | `POST /api/ai/projets/<id>/activer/` |
| Analyser forces/faiblesses | `POST /api/ai/projets/<id>/analyser/` |
| Generer les prochaines etapes | `POST /api/ai/projets/<id>/recommandations/generer/` |
| Poser des questions a l'IA | `POST /api/ai/conversations/<id>/messages/` |
| Recevoir des conseils personalises | Reponse IA dans `POST /api/ai/conversations/<id>/messages/` |
| Consulter l'historique des echanges | `GET /api/ai/conversations/<id>/` (inclut messages) |
| Obtenir des recommandations | `GET /api/ai/recommandations/?projet=<id>` |
| Consulter le projet | `GET /api/ai/projets/<id>/` |
| Modifier la description | `PATCH /api/ai/projets/<id>/` |
| Supprimer un brouillon | `DELETE /api/ai/projets/<id>/` (brouillon uniquement) |
| Supprimer une conversation | `DELETE /api/ai/conversations/<id>/` |
| Changer le statut d'une recommandation | `PATCH /api/ai/recommandations/<id>/statut/` |

---

## Stack

| Composant | Version |
|---|---|
| Python | 3.11+ |
| Django | 5.x |
| DRF | 3.15+ |
| drf-spectacular | 0.27+ |
| PostgreSQL | 16 |
| Port | **8006** |

---

## Installation locale

```bash
cd Backend/AI-Service
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_ia
python manage.py createsuperuser
python manage.py runserver 8006
```

---

## Variables d'environnement

| Variable | Defaut | Description |
|---|---|---|
| `SECRET_KEY` | requis | Cle secrete Django |
| `DEBUG` | `True` | Mode debug |
| `USE_POSTGRES` | `False` | Forcer PostgreSQL |
| `MARKET_SERVICE_URL` | `http://localhost:8005` | URL du Market-Service |
| `LLM_PROVIDER` | `openai` | Fournisseur LLM |
| `LLM_API_KEY` | vide | Cle API LLM (optionnel) |
| `LLM_MODEL` | `gpt-4o-mini` | Modele LLM |
| `LLM_BASE_URL` | API OpenAI | URL base LLM compatible OpenAI |

---

## API — Endpoints

| URL | Methode | Description |
|---|---|---|
| `/api/ai/health/` | GET | Health check |
| `/api/ai/docs/` | GET | Swagger UI |
| `/api/ai/schema/` | GET | Schema OpenAPI |
| `/api/ai/projets/` | GET, POST | CRUD projets |
| `/api/ai/projets/<id>/` | GET, PATCH, DELETE | Detail projet (suppr. brouillon uniquement) |
| `/api/ai/projets/<id>/activer/` | POST | Activer un projet |
| `/api/ai/projets/<id>/analyser/` | POST | Analyser forces/faiblesses |
| `/api/ai/projets/<id>/recommandations/generer/` | POST | Generer les prochaines etapes |
| `/api/ai/conversations/` | GET, POST | CRUD conversations |
| `/api/ai/conversations/<id>/` | GET | Detail avec historique |
| `/api/ai/conversations/<id>/messages/` | POST | Envoyer message / obtenir reponse IA |
| `/api/ai/recommandations/` | GET, POST | CRUD recommandations |
| `/api/ai/recommandations/<id>/statut/` | PATCH | Changer statut |
| `/api/ai/analyses/` | GET | Lister les analyses |
| `/api/ai/analyses/<id>/` | GET, DELETE | Detail / supprimer |

---

## Tests

```bash
python manage.py test tests --verbosity=2
```

---

## Docker

```bash
docker-compose up --build
```

Service accessible sur `http://localhost:8006`.

---

## Bloc YAML pour le docker-compose racine

```yaml
  cofondateur_db:
    image: postgres:16-alpine
    container_name: cofondateur_db
    environment:
      POSTGRES_DB: cofondateur_db
      POSTGRES_USER: cofondateur_user
      POSTGRES_PASSWORD: cofondateur_password
    volumes:
      - cofondateur_db_data:/var/lib/postgresql/data
    ports:
      - "5434:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cofondateur_user -d cofondateur_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  ai_service:
    build: ./Backend/AI-Service
    container_name: ai_service
    depends_on:
      cofondateur_db:
        condition: service_healthy
    environment:
      USE_POSTGRES: "True"
      DB_HOST: cofondateur_db
      DB_PORT: "5432"
      MARKET_SERVICE_URL: "http://market_service:8005"
    ports:
      - "8006:8006"
    command: >
      sh -c "python manage.py migrate && python manage.py seed_ia &&
             gunicorn config.wsgi:application --bind 0.0.0.0:8006 --workers 3"
    restart: unless-stopped

# Ajouter dans la section volumes:
# volumes:
#   cofondateur_db_data:
```
