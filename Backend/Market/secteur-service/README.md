# secteur-service — LaunchPad AI (étude de marché)

Microservice Django des **secteurs d'activité** et des **tendances** du marché.
Il fait partie des 4 services de l'étude de marché : voir [../README.md](../README.md).

| Élément | Valeur |
|---|---|
| Nom Eureka | `SECTEUR-SERVICE` |
| Port | **8010** |
| Base | PostgreSQL `secteur_db` (conteneur `secteur-db`, port hôte 5440) |
| Entités | `Secteur`, `Tendance` (FK `Tendance.secteur` : même service) |
| Health check | `GET /api/market/secteurs/health/` |
| Swagger UI | http://localhost:8010/api/market/secteurs/docs/ |
| Schéma OpenAPI | http://localhost:8010/api/market/secteurs/schema/ |
| Services appelés | `CONCURRENT-SERVICE` (analyse d'un secteur) |

## Endpoints

| Méthode | Chemin | Description |
|---|---|---|
| CRUD | `/api/market/secteurs/` | Secteurs (`?search=`, `?ids=1,2,3`) |
| CRUD | `/api/market/tendances/` | Tendances (`?secteur=`, `?impact=`, `?search=`, `?ids=`) |
| GET | `/api/market/analyse/secteur/<id>/` | Statistiques du secteur : concurrents lus en **un** appel `GET /api/market/concurrents/?secteur=<id>` sur CONCURRENT-SERVICE |
| GET | `/api/market/secteurs/health/` | `{"status": "UP", "service": "secteur-service"}` |

Le filtre `?ids=1,2,3` permet aux autres services de lire plusieurs secteurs ou tendances en
un seul appel (`SecteurClient.list(ids=[...])`).

**Suppression d'un secteur** : ses tendances sont supprimées (même base). Les concurrents et
études des autres services qui le référencent sont **conservés** : ils affichent alors
`secteur_nom = null` (pas de suppression en cascade entre services).

## Structure

```
secteur-service/
├── config/                 # settings (port, nom Eureka, URL des services appelés), urls
├── clients/                # appels REST vers les autres services (équivalent OpenFeign)
│   ├── base.py             # résolution Eureka, timeout 3 s, 1 nouvelle tentative, 404 / 503
│   └── concurrent_client.py
├── secteurs/
│   ├── models.py · serializers.py · views.py · urls.py · admin.py
│   ├── services/analyse.py # analyse d'un secteur (logique reprise du Market-Service)
│   ├── eureka.py           # enregistrement dans Eureka (py-eureka-client)
│   ├── exceptions.py       # ServiceIndisponible -> 503 JSON
│   ├── management/commands/seed_secteurs.py
│   └── tests/              # API, clients, CSRF, Eureka
├── Dockerfile · requirements.txt · .env.example
```

## Lancer en local (sans Docker)

```powershell
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # adapter DB_*, EUREKA_ENABLED, CONCURRENT_SERVICE_URL
python manage.py migrate
python manage.py seed_secteurs
python manage.py runserver 8010
```

Tests (sans PostgreSQL) : `$env:DB_ENGINE="sqlite"; python manage.py test`.
Avec Docker : `docker exec secteur-service python manage.py test`.
