# concurrent-service — LaunchPad AI (étude de marché)

Microservice Django des **concurrents** (prix moyen, part de marché, forces/faiblesses).
Il fait partie des 4 services de l'étude de marché : voir [../README.md](../README.md).

| Élément | Valeur |
|---|---|
| Nom Eureka | `CONCURRENT-SERVICE` |
| Port | **8011** |
| Base | PostgreSQL `concurrent_db` (conteneur `concurrent-db`, port hôte 5441) |
| Entité | `Concurrent` (`secteur_id` : entier nullable, **pas de clé étrangère**) |
| Health check | `GET /api/market/concurrents/health/` |
| Swagger UI | http://localhost:8011/api/market/concurrents/docs/ |
| Schéma OpenAPI | http://localhost:8011/api/market/concurrents/schema/ |
| Services appelés | `SECTEUR-SERVICE` (existence et nom du secteur) |

## Endpoints

| Méthode | Chemin | Description |
|---|---|---|
| CRUD | `/api/market/concurrents/` | Filtres `?secteur=`, `?pays=` (insensible à la casse), `?search=<nom>`, `?ordering=nom\|prix_moyen\|part_de_marche`, `?ids=1,2,3` |
| GET | `/api/market/concurrents/health/` | `{"status": "UP", "service": "concurrent-service"}` |

## Relation avec le secteur (appel REST via Eureka)

- **Création / modification** : `SecteurClient.exists(secteur_id)` appelle
  `GET /api/market/secteurs/<id>/` sur SECTEUR-SERVICE (adresse lue dans Eureka) :
  - secteur trouvé → enregistrement ;
  - 404 → `400 {"secteur_id": ["Secteur introuvable"]}` ;
  - service injoignable → `503 {"service": "SECTEUR-SERVICE", "message": "Service indisponible"}`.
  À la modification, le secteur n'est revérifié que s'il change.
- **Lecture** : `secteur_nom` est lu en **un seul** appel `?ids=...` pour toute la liste.
  Secteur supprimé ou SECTEUR-SERVICE arrêté → `secteur_nom = null` (la liste reste consultable).

## Événements RabbitMQ (exchange `market.events`)

| Rôle | Routing key | Queue | Action |
|---|---|---|---|
| Producer | `concurrent.supprime` (`concurrent_id`, `secteur_id`) | — | publié après la suppression d'un concurrent |
| Consumer | `secteur.supprime` | `concurrent.secteur-supprime` | `secteur_id = null` pour les concurrents du secteur supprimé |

Le consumer tourne dans le conteneur **`concurrent-consumer`** (`python manage.py consume_events`) ;
handler : `concurrents/handlers.py`. Détails : [../README.md](../README.md#communication-asynchrone-rabbitmq).

Format JSON compatible avec l'ancien Market-Service : `secteur` (id) et `secteur_nom` sont
conservés, `secteur_id` est ajouté ; en écriture, `secteur` ou `secteur_id` sont acceptés.

## Structure

```
concurrent-service/
├── config/                 # settings (port, nom Eureka, SECTEUR_SERVICE_URL), urls
├── clients/                # base.py (Eureka, timeout, nouvelle tentative) + secteur_client.py
├── evenements/             # RabbitMQ : producer, outbox + relais, consumer, consume_events
├── concurrents/
│   ├── models.py · serializers.py (vérification du secteur) · views.py · urls.py · admin.py
│   ├── handlers.py         # secteur.supprime
│   ├── eureka.py · exceptions.py · filtres.py
│   ├── management/commands/seed_concurrents.py   # --ids fichier.json (ids réels des secteurs)
│   └── tests/              # API (SECTEUR-SERVICE mocké), clients, CSRF, Eureka
├── Dockerfile · requirements.txt · .env.example
```

## Lancer en local (sans Docker)

```powershell
python -m venv venv; venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # adapter DB_*, EUREKA_ENABLED, SECTEUR_SERVICE_URL
python manage.py migrate
python manage.py seed_concurrents      # lit les secteurs sur SECTEUR-SERVICE (ou --ids fichier.json)
python manage.py runserver 8011
```

Tests (sans PostgreSQL) : `$env:DB_ENGINE="sqlite"; python manage.py test`.
