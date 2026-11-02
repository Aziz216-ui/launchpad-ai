# Étude de marché — 4 microservices (LaunchPad AI)

L'ancien **Market-Service** (une application Django, 6 entités liées par des clés étrangères
dans une seule base) est découpé en **4 microservices indépendants**. Chacun a son propre
projet Django, son CRUD, sa base PostgreSQL et son image Docker. Les relations entre entités
de services différents ne passent plus par des clés étrangères mais par des **appels REST**
vers des services **découverts via Eureka**.

Les URLs publiques et les formats JSON sont **inchangés** (mêmes champs, plus les nouveaux `*_id`) :
le frontend et le AI-Service n'ont rien à modifier, ils passent par l'API Gateway (8090).

## Architecture

```
                         Frontend Angular (4200)          AI-Service
                                    │                         │
                                    ▼                         ▼
                     ┌──────────── API Gateway :8090 ─────────────────────┐
                     │ /api/market/secteurs/** /tendances/**              │──► SECTEUR-SERVICE
                     │ /api/market/analyse/secteur/**                     │
                     │ /api/market/concurrents/**                         │──► CONCURRENT-SERVICE
                     │ /api/market/etudes/*/generer-swot/** /swot/**      │──► SWOT-SERVICE
                     │ /api/market/etudes/** /personas/** /analyse/projet/**──► ETUDE-SERVICE
                     └───────────────────────┬────────────────────────────┘
                                             │ lb://<NOM> : adresse lue dans Eureka
                                             ▼
                                ┌────────── Eureka :8761 ──────────┐
                                │ registre : 4 services UP         │◄── enregistrement
                                └──────────────────────────────────┘    (py-eureka-client)
                                             ▲ résolution par nom (clients/)
   ┌─────────────────────┐   ┌───────────────┴─────┐   ┌─────────────────────┐   ┌─────────────────────┐
   │ secteur-service     │◄──│ concurrent-service  │   │ etude-service       │──►│ swot-service        │
   │ :8010               │   │ :8011               │   │ :8012               │◄──│ :8013               │
   │ Secteur, Tendance   │──►│ Concurrent          │◄──│ EtudeMarche, Persona│   │ ElementSWOT         │
   └─────────┬───────────┘   └─────────┬───────────┘   └──┬──────┬───────────┘   └─────────┬───────────┘
             ▼                         ▼                  │      ▼                         ▼
      secteur_db :5440         concurrent_db :5441        │  etude_db :5442           swot_db :5443
                                                          └──► SECTEUR-SERVICE (secteur, tendances)
```

Image : [Documentation/Diagrams/Market/architecture-microservices.png](../../Documentation/Diagrams/Market/architecture-microservices.png)

## Les 4 services

| Sous-module | Nom Eureka | Port | Entités | Base (port hôte) | Appelle | Swagger |
|---|---|---|---|---|---|---|
| [secteur-service](secteur-service/) | `SECTEUR-SERVICE` | 8010 | Secteur, Tendance | `secteur_db` (5440) | CONCURRENT | `/api/market/secteurs/docs/` |
| [concurrent-service](concurrent-service/) | `CONCURRENT-SERVICE` | 8011 | Concurrent | `concurrent_db` (5441) | SECTEUR | `/api/market/concurrents/docs/` |
| [etude-service](etude-service/) | `ETUDE-SERVICE` | 8012 | EtudeMarche, Persona | `etude_db` (5442) | SECTEUR, CONCURRENT, SWOT | `/api/market/etudes/docs/` |
| [swot-service](swot-service/) | `SWOT-SERVICE` | 8013 | ElementSWOT | `swot_db` (5443) | ETUDE | `/api/market/swot/docs/` |

Health checks : `/api/market/secteurs/health/`, `/api/market/concurrents/health/`,
`/api/market/etudes/health/`, `/api/market/swot/health/`.

### Relations : de la clé étrangère à l'appel REST

| Avant (Market-Service) | Après | Vérification |
|---|---|---|
| `Concurrent.secteur` (FK) | `Concurrent.secteur_id` (entier) | concurrent-service → SECTEUR-SERVICE |
| `Tendance.secteur` (FK) | inchangé (même service) | — |
| `EtudeMarche.secteur` (FK) | `secteur_id` | etude-service → SECTEUR-SERVICE |
| `EtudeMarche.concurrents` (M2M) | `concurrent_ids` (liste) | etude-service → CONCURRENT-SERVICE (`?ids=`) |
| `EtudeMarche.tendances` (M2M) | `tendance_ids` (liste) | etude-service → SECTEUR-SERVICE (`/tendances/?ids=`) |
| `Persona.etude` (FK) | inchangé (même service) | — |
| `ElementSWOT.etude` (FK) | `etude_id` | swot-service → ETUDE-SERVICE |

## Méthode de communication (équivalent OpenFeign en Python)

Chaque service qui en appelle d'autres a un package `clients/` avec une classe par service appelé
(`SecteurClient`, `ConcurrentClient`, `EtudeClient`, `SwotClient`), qui hérite de
`clients/base.py::ServiceClient` :

1. **Résolution par nom** : `py_eureka_client.eureka_basic.get_application(EUREKA_SERVER_URL, "SECTEUR-SERVICE")`
   → une instance `UP` au hasard → `http://hote:port` (mise en cache 15 s).
   **Repli** sur l'URL directe `<NOM>_SERVICE_URL` (ex. `SECTEUR_SERVICE_URL`) si Eureka est
   désactivé (`EUREKA_ENABLED=false`), injoignable ou ne connaît aucune instance.
2. **Appel HTTP** (`requests`) avec **timeout de 3 s** et **une nouvelle tentative** en cas d'erreur
   réseau ou de 5xx (l'adresse est alors relue dans Eureka).
3. **Erreurs** :
   - 404 → `RessourceIntrouvable` → traduite en **400** côté appelant (`{"secteur_id": ["Secteur introuvable"]}`) ;
   - service injoignable → `ServiceIndisponible` → **503** `{"service": "<NOM>", "message": "Service indisponible"}`
     (même format que la gateway ; un 503 venant d'un service plus loin dans la chaîne garde le nom du service en cause).
4. **Méthodes** : `get(id)`, `exists(id)`, `list(ids=[...], **filtres)`. Chaque liste accepte
   `?ids=1,2,3` : N ressources sont lues en **un** appel.

```python
# concurrent-service/concurrents/serializers.py
if not SecteurClient().exists(secteur_id):
    raise serializers.ValidationError({"secteur_id": "Secteur introuvable"})
```

**Docker** : les services s'enregistrent sous `localhost:<port>` pour que la gateway (lancée sur
l'hôte) les joigne. Dans un conteneur, `localhost` désigne le conteneur lui-même : l'adresse lue
dans Eureka est réécrite avec `EUREKA_LOCALHOST_ALIAS=host.docker.internal`.

Aucun code n'est partagé entre les 4 projets : `clients/base.py`, `eureka.py`, `exceptions.py`
et `filtres.py` sont dupliqués volontairement pour que chaque service reste indépendant.

### Choix de conception

- **Suppression simple, sans cascade entre services** : supprimer un secteur supprime ses
  tendances (même base) mais pas les concurrents ni les études qui le référencent. Ces services
  gèrent un secteur devenu introuvable sans erreur : `secteur_nom = null` (listes, détail,
  rapport). Un concurrent ou une tendance supprimés sont ignorés dans les calculs de l'étude.
  Seule exception : supprimer une étude demande à SWOT-SERVICE de supprimer sa SWOT
  (au mieux : si SWOT-SERVICE est arrêté, l'étude est quand même supprimée).
- **Lectures dégradées, écritures strictes** : si SECTEUR-SERVICE est arrêté, les listes de
  concurrents et d'études restent consultables (`secteur_nom = null`), mais une création ou une
  modification qui doit vérifier un id répond 503 (rien n'est enregistré sans vérification).
  Les agrégations (analyses, comparaison des prix, rapport, génération SWOT) répondent 503.
- **Logique métier conservée** : les fonctions de `marche/services/` (analyses, prix,
  opportunités/menaces, potentiel, rapport PDF, règles SWOT) sont reprises ; seule la lecture
  des données change (dictionnaires reçus en JSON au lieu de requêtes ORM).

## Tout lancer

Prérequis : Docker Desktop, JDK 17.

```powershell
# 1. Eureka (port 8761)
cd Backend\Eureka
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"; .\mvnw spring-boot:run

# 2. Les 4 services + 4 bases (autre terminal)
cd Backend\Market
docker compose up -d --build
docker compose ps                  # 8 conteneurs, bases "healthy"

# 3. Données de démonstration (secteurs -> concurrents -> études -> SWOT)
.\seed_all.ps1                     # -Reset pour repartir de zéro

# 4. API Gateway (port 8090, profil eureka)
cd ..\API-Gateway
$env:JAVA_HOME="C:\Program Files\Java\jdk-17"; .\mvnw spring-boot:run

# 5. Test de bout en bout via la gateway
cd ..\Market
.\test_e2e.ps1
```

- Eureka : http://localhost:8761 (SECTEUR-SERVICE, CONCURRENT-SERVICE, ETUDE-SERVICE, SWOT-SERVICE : UP)
- Swagger via la gateway : http://localhost:8090/api/market/etudes/docs/ (et `secteurs`, `concurrents`, `swot`)
- Analyse d'un projet (AI-Service) : http://localhost:8090/api/market/analyse/projet/1/

Arrêt : `docker compose down` (les données restent dans les volumes ; `down -v` les supprime).

### Sans Docker

Chaque service se lance avec `python manage.py runserver <port>` (voir son README). Avec
`EUREKA_ENABLED=false`, les services s'appellent par les URL directes
`http://localhost:8010` à `8013` (valeurs par défaut de `<NOM>_SERVICE_URL`).

## Données de démonstration

`seed_all.ps1` lance dans l'ordre `seed_secteurs`, `seed_concurrents`, `seed_etudes` et
`seed_swot` dans les conteneurs. Entre deux étapes, il lit les **ids réels** sur l'API du service
précédent, les écrit dans un fichier JSON et le passe au suivant (`--ids`). On retrouve les données
de l'ancien seed : FinTech, EdTech, HealthTech, 10 concurrents, 7 tendances, 4 études
(projets 1, 2 et 3), 3 personas, la SWOT des deux études complètes. Le script peut être relancé
sans créer de doublons.

## Tests

| Niveau | Commande | Contenu |
|---|---|---|
| Unitaires (par service) | `docker exec <service> python manage.py test` ou `$env:DB_ENGINE="sqlite"; python manage.py test` | API avec les clients REST **mockés** (ressource existante, absente → 400, service indisponible → 503), client générique (Eureka, repli, nouvelle tentative), CSRF, Eureka, seed |
| Gateway | `cd ..\API-Gateway; .\mvnw clean verify` | `MarketRoutesTest` : chaque chemin arrive au bon service |
| Bout en bout | `.\test_e2e.ps1` | via la gateway : création liée, SWOT, rapport JSON/PDF, 400, 503 (`docker stop secteur-service`), nettoyage |

## Structure

```
Market/
├── docker-compose.yml          # 4 services + 4 PostgreSQL, réseau market-net
├── seed_all.ps1                # seed dans l'ordre avec les ids réels
├── test_e2e.ps1                # test de bout en bout via la gateway
├── secteur-service/            # projet Django complet (config/, clients/, secteurs/, Dockerfile…)
├── concurrent-service/
├── etude-service/
└── swot-service/
```

Diagrammes : [Documentation/Diagrams/Market/](../../Documentation/Diagrams/Market/).
