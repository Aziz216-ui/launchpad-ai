# swot-service — LaunchPad AI (étude de marché)

Microservice Django de l'**analyse SWOT** des études : saisie manuelle des éléments et
génération automatique par règles (reprises telles quelles du Market-Service).
Vue d'ensemble : [../README.md](../README.md).

| Élément | Valeur |
|---|---|
| Nom Eureka | `SWOT-SERVICE` |
| Port | **8013** |
| Base | PostgreSQL `swot_db` (conteneur `swot-db`, port hôte 5443) |
| Entité | `ElementSWOT` (`etude_id` : entier, **pas de clé étrangère**) |
| Health check | `GET /api/market/swot/health/` |
| Swagger UI | http://localhost:8013/api/market/swot/docs/ |
| Schéma OpenAPI | http://localhost:8013/api/market/swot/schema/ |
| Services appelés | `ETUDE-SERVICE` (et, à travers lui, CONCURRENT-SERVICE et SECTEUR-SERVICE) |

## Endpoints

| Méthode | Chemin | Description |
|---|---|---|
| CRUD | `/api/market/swot/` | Éléments (`?etude=`, `?type=`, `?ids=`). Créés ici = saisie manuelle (`genere_automatiquement = false`) ; l'étude est vérifiée sur ETUDE-SERVICE (400 si absente, 503 si injoignable) |
| DELETE | `/api/market/swot/etude/<etude_id>/` | Supprime la SWOT d'une étude (appelé par ETUDE-SERVICE quand l'étude est supprimée) |
| POST | `/api/market/etudes/<id>/generer-swot/` | Génère la SWOT : remplace les éléments automatiques, **conserve les éléments manuels** |
| GET | `/api/market/etudes/<id>/generer-swot/` | Aperçu de la SWOT calculée, **sans enregistrement** (utilisé par le rapport quand l'étude n'a aucun élément) |

La gateway envoie `/api/market/etudes/*/generer-swot/**` à ce service (route placée avant celle
d'ETUDE-SERVICE).

## Génération : données lues sur ETUDE-SERVICE

`EtudeClient` (clients/etude_client.py) fait trois appels, **avant** la transaction (rien n'est
supprimé si un service manque) :

1. `GET /api/market/etudes/<id>/` : offre décrite, prix proposé, personas ;
2. `GET /api/market/etudes/<id>/comparaison-prix/` : positionnement prix, nombre de concurrents ;
3. `GET /api/market/etudes/<id>/opportunites-menaces/` : tendances, concurrence, croissance.

Étude absente → 404 ; un service de la chaîne arrêté → 503 avec le nom du service en cause
(ex. `{"service": "CONCURRENT-SERVICE", "message": "Service indisponible"}`).

## Lancer en local (sans Docker)

```powershell
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # adapter DB_*, EUREKA_ENABLED, ETUDE_SERVICE_URL
python manage.py migrate
python manage.py seed_swot      # ETUDE-SERVICE démarré (ou --ids fichier.json)
python manage.py runserver 8013
```

Tests (sans PostgreSQL) : `$env:DB_ENGINE="sqlite"; python manage.py test`.
