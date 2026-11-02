# etude-service — LaunchPad AI (étude de marché)

Microservice Django des **études de marché** et des **personas** : comparaison des prix,
opportunités/menaces, potentiel commercial, rapport JSON/PDF et analyse d'un projet
(consommée par le AI-Service). Il **agrège** les données des trois autres services.
Vue d'ensemble : [../README.md](../README.md).

| Élément | Valeur |
|---|---|
| Nom Eureka | `ETUDE-SERVICE` |
| Port | **8012** |
| Base | PostgreSQL `etude_db` (conteneur `etude-db`, port hôte 5442) |
| Entités | `EtudeMarche` (`secteur_id`, `concurrent_ids`, `tendance_ids` : ids, pas de FK), `Persona` (FK vers `EtudeMarche` : même service) |
| Health check | `GET /api/market/etudes/health/` |
| Swagger UI | http://localhost:8012/api/market/etudes/docs/ |
| Schéma OpenAPI | http://localhost:8012/api/market/etudes/schema/ |
| Services appelés | `SECTEUR-SERVICE`, `CONCURRENT-SERVICE`, `SWOT-SERVICE` |

## Endpoints (URLs inchangées par rapport au Market-Service)

| Méthode | Chemin | Données distantes utilisées |
|---|---|---|
| CRUD | `/api/market/etudes/` (`?projet_id=`, `?entrepreneur_id=`, `?statut=`, `?ids=`) | vérification de `secteur_id`, `concurrent_ids`, `tendance_ids` ; `secteur_nom` |
| GET | `/api/market/etudes/<id>/` (détail) | `concurrents_details`, `tendances_details`, `swot` |
| POST | `/api/market/etudes/<id>/finaliser/` | — |
| GET | `/api/market/etudes/<id>/comparaison-prix/` | concurrents (1 appel `?ids=`) |
| GET | `/api/market/etudes/<id>/opportunites-menaces/` | concurrents + tendances |
| GET | `/api/market/etudes/<id>/rapport/` et `/rapport/pdf/` | secteur, concurrents, tendances, SWOT (enregistrée, sinon aperçu calculé par SWOT-SERVICE) |
| CRUD | `/api/market/personas/` (`?etude=`) | — |
| GET | `/api/market/analyse/projet/<projet_id>/` | secteurs, concurrents et tendances de chaque secteur ; **toujours 200** (projet sans étude → listes vides, `niveau_concurrence = "inconnu"`) |

`POST /api/market/etudes/<id>/generer-swot/` est servi par **SWOT-SERVICE** (route dédiée dans la gateway).

## Règles entre services

- Écriture : un id inexistant → **400** (`{"secteur_id": ["Secteur introuvable"]}`,
  `{"concurrent_ids": ["Concurrent(s) introuvable(s) : 9999"]}`…) ; service injoignable → **503**
  `{"service": "<NOM>", "message": "Service indisponible"}`. Seuls les ids nouveaux ou modifiés
  sont vérifiés, en un appel `?ids=` par service.
- Secteur supprimé dans SECTEUR-SERVICE → `secteur_nom = null`, `marche_cible.secteur.nom = null`
  dans le rapport ; concurrent ou tendance supprimés → simplement ignorés dans les calculs.
- Suppression d'une étude : ses personas sont supprimés (même base) et ETUDE-SERVICE demande à
  SWOT-SERVICE de supprimer sa SWOT (`DELETE /api/market/swot/etude/<id>/`). Si SWOT-SERVICE est
  arrêté, l'étude est quand même supprimée (avertissement dans les logs).
- Format JSON compatible : `secteur`, `concurrents`, `tendances` conservés, `secteur_id`,
  `concurrent_ids`, `tendance_ids` ajoutés (les deux noms sont acceptés en écriture).

## Structure

```
etude-service/
├── config/
├── clients/                # base.py + secteur_client.py, concurrent_client.py, swot_client.py
├── etudes/
│   ├── models.py · serializers.py · views.py · urls.py · admin.py
│   ├── services/           # analyse.py, etude.py, rapport_pdf.py (logique reprise du Market-Service)
│   ├── eureka.py · exceptions.py · filtres.py
│   ├── management/commands/seed_etudes.py   # --ids fichier.json (secteurs, concurrents, tendances)
│   └── tests/              # faux_services.py (3 services simulés), étude, analyse, clients, CSRF, Eureka
├── Dockerfile · requirements.txt · .env.example
```

## Lancer en local (sans Docker)

```powershell
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # adapter DB_*, EUREKA_ENABLED, *_SERVICE_URL
python manage.py migrate
python manage.py seed_etudes    # lit les ids sur les autres services (ou --ids fichier.json)
python manage.py runserver 8012
```

Tests (sans PostgreSQL) : `$env:DB_ENGINE="sqlite"; python manage.py test`.
