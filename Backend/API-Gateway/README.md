# API Gateway — LaunchPad AI

Point d'entrée **unique** du frontend Angular vers les microservices de LaunchPad AI.
Le frontend n'appelle plus chaque service sur son port : il appelle la gateway sur
**http://localhost:8090**, qui retrouve le service dans **Eureka** et lui relaie la requête.

| Élément | Valeur |
|---|---|
| Port | **8090** (`SERVER_PORT`) — 8080 est pris par Keycloak |
| Nom Eureka | `API-GATEWAY` |
| Eureka | `Backend/Eureka`, port 8761, `http://localhost:8761/eureka/` |
| Routes chargées | http://localhost:8090/actuator/gateway/routes |
| Santé | http://localhost:8090/actuator/health |

**Stack :** Java 17 (comme `Backend/Eureka`), Maven, Spring Boot 4.1.1 (même version que `Backend/Eureka`), Spring Cloud
2025.1.3, Spring Cloud Gateway réactif (WebFlux / Netty), client Eureka, Actuator,
OAuth2 Resource Server (JWT Keycloak).

> Avec Spring Cloud 2025.1, le starter réactif s'appelle `spring-cloud-starter-gateway-server-webflux`
> (l'ancien `spring-cloud-starter-gateway` s'arrête à Spring Cloud 2025.0) et les propriétés
> sont sous `spring.cloud.gateway.server.webflux.*`.

---

## Rôle et fonctionnement

```
                       ┌──────────────────────────── API Gateway :8090 ────────────────────────────┐
 Frontend Angular      │ CORS (http://localhost:4200) · JWT Keycloak (si JWT_ENABLED=true)           │
 http://localhost:4200 │ logs + X-Request-Id · 503 JSON si service absent                            │
        │              │ routage par préfixe : /api/market/secteurs/** → lb://SECTEUR-SERVICE …      │
        └─────────────►└───────────────┬─────────────────────────────────────────────┬──────────────┘
                                       │ 1. « où est SECTEUR-SERVICE ? »              │ 2. requête relayée
                                       ▼                                             ▼   (chemin inchangé)
                          ┌────────────────────────┐          ┌──────────────────────────────────────┐
                          │ Eureka :8761           │◄─────────│ Market : 4 services :8010-8013        │
                          │ registre des services  │ enregis- │ Professional-Service :8085            │
                          └────────────────────────┘ trement  │ Lawyer :8082/8084-8086 · Legal :3003… │
                                                              └──────────────────────────────────────┘
```

1. Chaque service s'enregistre dans Eureka sous son nom (ex. `SECTEUR-SERVICE`).
2. La gateway choisit la route d'après le préfixe (`/api/market/secteurs/**`), demande à Eureka où se
   trouve le service (`lb://SECTEUR-SERVICE`) et lui relaie la requête **sans changer le chemin**.
3. Si le service n'est pas enregistré, ne répond pas ou coupe la connexion avant de répondre :
   `503 {"service": "SECTEUR-SERVICE", "message": "Service indisponible"}`.

Fonctionnalités transverses (aucun service n'a à les refaire) :
- **CORS** : uniquement ici (origine `http://localhost:4200`, configurable par `CORS_ALLOWED_ORIGINS`) ;
  méthodes GET/POST/PUT/PATCH/DELETE/OPTIONS, en-têtes `Authorization` et `Content-Type`.
  Les en-têtes CORS sont aussi présents sur les 401 et 503. `DedupeResponseHeader` supprime les
  doublons si un service en envoie quand même.
- **Logs** : une ligne par requête `GET /api/market/etudes/ -> 200 (12 ms) [<X-Request-Id>]`.
- **X-Request-Id** : conservé s'il est envoyé par le frontend, sinon généré ; transmis au service
  et renvoyé dans la réponse (pratique pour suivre une requête dans les logs de chaque service).
- **Authorization: Bearer <token>** : toujours transmis tel quel aux services.

---

## Services

| Service | Nom Eureka | Port | Préfixe (route) | Route id | Variable de surcharge | Docs (côté service) |
|---|---|---|---|---|---|---|
| Market : secteurs, tendances | `SECTEUR-SERVICE` | 8010 | `/api/market/secteurs/**`, `/api/market/tendances/**`, `/api/market/analyse/secteur/**` | `market-secteur-service` | `SECTEUR_SERVICE_URI` | `/api/market/secteurs/docs/`, `/api/market/secteurs/schema/` |
| Market : concurrents | `CONCURRENT-SERVICE` | 8011 | `/api/market/concurrents/**` | `market-concurrent-service` | `CONCURRENT_SERVICE_URI` | `/api/market/concurrents/docs/`, `/api/market/concurrents/schema/` |
| Market : SWOT | `SWOT-SERVICE` | 8013 | `/api/market/etudes/*/generer-swot/**`, `/api/market/swot/**` | `market-swot-service` | `SWOT_SERVICE_URI` | `/api/market/swot/docs/`, `/api/market/swot/schema/` |
| Market : études, personas | `ETUDE-SERVICE` | 8012 | `/api/market/etudes/**`, `/api/market/personas/**`, `/api/market/analyse/projet/**` | `market-etude-service` | `ETUDE_SERVICE_URI` | `/api/market/etudes/docs/`, `/api/market/etudes/schema/` |
| Comptable | `PROFESSIONAL-SERVICE` | 8085 | `/api/comptable/**` | `accounting-service` | `ACCOUNTING_SERVICE_URI` | `/api/comptable/docs`, `/api/comptable/docs.json` |
| Avocat : clients | `lawyer-client-service` (minuscules) | 8082 | `/api/lawyer/clients/**` | `lawyer-client-service` | `LAWYER_CLIENT_SERVICE_URI` | `/swagger-ui/**`, `/v3/api-docs/**` (hors préfixe) |
| Avocat : messages | `lawyer-message-service` | 8084 | `/api/lawyer/messages/**`, `/api/lawyer/communication/messages/**` | `lawyer-message-service` | `LAWYER_MESSAGE_SERVICE_URI` | `/swagger-ui/**`, `/v3/api-docs/**` (même chemin) |
| Avocat : revue de documents | `lawyer-docreview-service` | 8086 | `/api/lawyer/reviews/**`, `/api/lawyer/document-reviews/**` | `lawyer-docreview-service` | `LAWYER_DOCREVIEW_SERVICE_URI` | `/swagger-ui/**`, `/v3/api-docs/**` (même chemin) |
| Juridique | `LEGAL-SERVICE` | 3003 | `/api/legal/**` | `legal-service` | `LEGAL_SERVICE_URI` | `/api/docs`, `/api/docs-json` (hors préfixe) |
| IA : projets, analyses | `PROJET-SERVICE` | 8006 | `/api/ai/projets/**`, `/api/ai/analyses/**`, `/api/ai/health/**` (+ `/api/ai/docs/`, `/api/ai/schema/` par défaut) | `ai-projet-service` | `PROJET_SERVICE_URI` | `/api/ai/docs/`, `/api/ai/schema/` |
| IA : recommandations | `RECOMMANDATION-SERVICE` | 8007 | `/api/ai/recommandations/**` | `ai-recommandation-service` | `RECOMMANDATION_SERVICE_URI` | `/api/ai/docs/`, `/api/ai/schema/` (même chemin) |
| IA : conversations | `CONVERSATION-SERVICE` | 8008 | `/api/ai/conversations/**` | `ai-conversation-service` | `CONVERSATION_SERVICE_URI` | `/api/ai/docs/`, `/api/ai/schema/` (même chemin) |
| Finance : documents | `DOCUMENT-SERVICE` | 8083 | `/api/finance/documents/**`, `/api/finance/projets/*/documents`, `/api/finance/projets/*/notifications` | `document-service` | `DOCUMENT_SERVICE_URI` | `/swagger-ui.html`, `/v3/api-docs` (hors préfixe, accès direct sur 8083) |
| Finance : prévisions | `PREVISION-SERVICE` | 8081 | `/api/finance/**` (après `document-service`) | `prevision-service` | `PREVISION_SERVICE_URI` | `/swagger-ui.html`, `/v3/api-docs` (hors préfixe, accès direct sur 8081) |
| Utilisateurs (Django + Keycloak) | `user-service` (minuscules) | 8001 | `/api/auth/**` | `user-service` | `USER_SERVICE_URI` | `/api/docs/`, `/api/redoc/`, `/api/schema/` (hors préfixe) |

Les 4 routes Market sont déclarées **dans cet ordre** : la SWOT passe avant les études, sinon
`/api/market/etudes/5/generer-swot/` partirait vers ETUDE-SERVICE. Chaque service Market a aussi
une route de docs explicite (`market-secteur-docs`, `market-concurrent-docs`, `market-swot-docs`,
`market-etude-docs`), placée en tête. Détails : [Backend/Market/README.md](../Market/README.md).

Les 3 services IA (Co-Fondateur IA, [Backend/AI-Service](../AI-Service)) partagent le préfixe
`/api/ai/` et servent tous leur health, leur Swagger UI et leur schéma aux **mêmes chemins**
(`/api/ai/health/`, `/api/ai/docs/`, `/api/ai/schema/`) :
- `/api/ai/health/` (et `/api/ai/docs/`, `/api/ai/schema/` appelés directement) va à **PROJET-SERVICE**,
  le service central dont dépendent les deux autres ;
- les docs de chaque service sont exposées sous `/docs/ai/<service>/docs/` et `/docs/ai/<service>/schema/`
  (routes `ai-projet-docs`, `ai-recommandation-docs`, `ai-conversation-docs`, réécrites vers `/api/ai/...`) ;
- la page Swagger UI charge son schéma à l'adresse absolue `/api/ai/schema/` : les routes
  `ai-recommandation-schema` et `ai-conversation-schema` l'envoient au service dont la page fait la
  demande (en-tête `Referer` contenant `/docs/ai/recommandation/` ou `/docs/ai/conversation/`).
  Elles sont déclarées avant `ai-projet-service`.

Les 3 services avocat ([Backend/Lawyer-*-Service](..)) partagent le préfixe `/api/lawyer/`, découpé
par ressource (les chemins arrivent inchangés). Ils servent tous leurs docs springdoc aux **mêmes
chemins** (`/swagger-ui/**`, `/v3/api-docs/**`) :
- les docs de chaque service sont exposées sous `/docs/lawyer/<service>/swagger-ui/**` et
  `/docs/lawyer/<service>/v3/api-docs/**` (routes `lawyer-<service>-docs`, réécrites vers `/swagger-ui/**`
  et `/v3/api-docs/**`), avec `<service>` = `client`, `message` ou `docreview` ;
- la page Swagger UI charge sa configuration et son schéma à l'adresse absolue `/v3/api-docs/**` :
  les routes `lawyer-<service>-schema` l'envoient au service dont la page fait la demande (en-tête
  `Referer` contenant `/docs/lawyer/<service>/`). Sans ce Referer, `/v3/api-docs` n'est pas routé (404).

Le User-Service ([Backend/User-Service](../User-Service)) sert `/api/auth/**` (register, login,
refresh, logout, profile, health, lawyers). Ses docs drf-spectacular sont hors préfixe : elles sont
exposées sous `/docs/user/docs/`, `/docs/user/redoc/` et `/docs/user/schema/` (route `user-docs`,
réécrite vers `/api/...`). Les pages Swagger UI et ReDoc chargent leur schéma à l'adresse absolue
`/api/schema/` : la route `user-schema` l'envoie au User-Service quand le `Referer` contient `/docs/user/`.

Routes de documentation supplémentaires (réécriture, pour les docs servies hors préfixe) :

| Route id | Chemin gateway | Chemin envoyé au service |
|---|---|---|
| `lawyer-<service>-docs` | `/docs/lawyer/<service>/swagger-ui/**` | `/swagger-ui/**` |
| `lawyer-<service>-docs` | `/docs/lawyer/<service>/v3/api-docs/**` | `/v3/api-docs/**` |
| `user-docs` | `/docs/user/{docs,redoc,schema}/**` | `/api/{docs,redoc,schema}/**` |
| `legal-docs` | `/docs/legal/**` | `/api/docs/**` |
| `legal-docs-json` | `/docs/legal-json` | `/api/docs-json` |

Les routes juridiques `/docs/legal…` sont à supprimer si le Legal-Service passe ses docs sous
`/api/legal/docs` (elles passeront alors par la route métier).

## Où trouver la doc de chaque service via la gateway

| Service | Swagger UI | Définition OpenAPI |
|---|---|---|
| Market : secteurs, tendances | http://localhost:8090/api/market/secteurs/docs/ | http://localhost:8090/api/market/secteurs/schema/ |
| Market : concurrents | http://localhost:8090/api/market/concurrents/docs/ | http://localhost:8090/api/market/concurrents/schema/ |
| Market : études, personas | http://localhost:8090/api/market/etudes/docs/ | http://localhost:8090/api/market/etudes/schema/ |
| Market : SWOT | http://localhost:8090/api/market/swot/docs/ | http://localhost:8090/api/market/swot/schema/ |
| Comptable | http://localhost:8090/api/comptable/docs | http://localhost:8090/api/comptable/docs.json |
| Avocat : clients | http://localhost:8090/docs/lawyer/client/swagger-ui/index.html | http://localhost:8090/docs/lawyer/client/v3/api-docs |
| Avocat : messages | http://localhost:8090/docs/lawyer/message/swagger-ui/index.html | http://localhost:8090/docs/lawyer/message/v3/api-docs |
| Avocat : revue de documents | http://localhost:8090/docs/lawyer/docreview/swagger-ui/index.html | http://localhost:8090/docs/lawyer/docreview/v3/api-docs |
| Juridique | http://localhost:8090/docs/legal | http://localhost:8090/docs/legal-json |
| IA : projets, analyses | http://localhost:8090/docs/ai/projet/docs/ | http://localhost:8090/docs/ai/projet/schema/ |
| IA : recommandations | http://localhost:8090/docs/ai/recommandation/docs/ | http://localhost:8090/docs/ai/recommandation/schema/ |
| IA : conversations | http://localhost:8090/docs/ai/conversation/docs/ | http://localhost:8090/docs/ai/conversation/schema/ |
| Finance (documents) | http://localhost:8083/swagger-ui.html (direct) | http://localhost:8083/v3/api-docs (direct) |
| Finance (prévisions) | http://localhost:8081/swagger-ui.html (direct) | http://localhost:8081/v3/api-docs (direct) |
| Utilisateurs | http://localhost:8090/docs/user/docs/ (ReDoc : http://localhost:8090/docs/user/redoc/) | http://localhost:8090/docs/user/schema/ |

> Avocat (springdoc) : ouvrir directement `.../swagger-ui/index.html` (et non `/swagger-ui.html`,
> qui redirige vers une adresse absolue hors gateway).

Toutes ces docs sont **publiques**, même quand le JWT est activé.

---

## Configuration

Tout est dans `src/main/resources/` :
- `application.yml` : port, CORS, routes (un bloc commenté par service), sécurité, actuator ;
- `application-eureka.yml` : profil **eureka** (par défaut) ;
- `application-local.yml` : profil **local** (URL directes, sans Eureka).

| Variable | Défaut | Rôle |
|---|---|---|
| `SERVER_PORT` | `8090` | Port de la gateway |
| `SPRING_PROFILES_ACTIVE` | `eureka` | `eureka` ou `local` |
| `EUREKA_SERVER_URL` | `http://localhost:8761/eureka/` | Serveur Eureka (profil eureka) |
| `EUREKA_INSTANCE_HOST` | `localhost` | Adresse de la gateway annoncée dans Eureka |
| `<NOM>_SERVICE_URI` | `lb://<NOM-EUREKA>` (eureka) / `http://localhost:<port>` (local) | Surcharge l'adresse d'un service (voir tableau) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Origines autorisées (séparées par des virgules) |
| `JWT_ENABLED` | `false` | `true` : JWT Keycloak obligatoire hors routes publiques |
| `KEYCLOAK_JWK_SET_URI` | `http://localhost:8080/realms/launchpad/protocol/openid-connect/certs` | Clés publiques du realm Keycloak |

### Profils

- **eureka** (par défaut) : la gateway s'enregistre dans Eureka et route en `lb://<NOM-EUREKA>`.
  Le registre est relu toutes les 5 s : un service qui démarre est joignable quelques secondes après.
- **local** : sans Eureka, URL directes `http://localhost:<port>` pour Market (8010 à 8013),
  Comptable (8085), Avocat (8082, 8084, 8086), Juridique (3003), Finance prévisions (8081), Finance
  documents (8083), IA (projets 8006, recommandations 8007, conversations 8008) et
  Utilisateurs (8001).

Dans les deux profils, `<NOM>_SERVICE_URI` bascule un service en URL directe, par exemple pour
tester le service d'un autre membre sur son PC : `LEGAL_SERVICE_URI=http://192.168.1.20:3003`.

---

## Lancement

Prérequis : **JDK 17** (`java -version` doit afficher 17 ; si `JAVA_HOME` est défini, il doit
pointer vers ce JDK) et Eureka démarré pour le profil eureka.

```powershell
# 1. Eureka (si ce n'est pas déjà fait)
cd Backend\Eureka
.\mvnw spring-boot:run

# 2. Gateway, profil eureka (par défaut)
cd Backend\API-Gateway
.\mvnw spring-boot:run
```

Profil local (sans Eureka) :

```powershell
cd Backend\API-Gateway
.\mvnw spring-boot:run "-Dspring-boot.run.profiles=local"
# ou : $env:SPRING_PROFILES_ACTIVE="local"; .\mvnw spring-boot:run
```

Ouvrir http://localhost:8761 : `API-GATEWAY` apparaît dans « Instances currently registered with Eureka ».

### Avec Docker

```powershell
cd Backend\API-Gateway
docker compose up -d --build
docker compose logs -f api-gateway
```

Eureka et les services tournent sur la machine hôte : le `docker-compose.yml` utilise
`EUREKA_SERVER_URL=http://host.docker.internal:8761/eureka/`. Un service enregistré dans Eureka
sous `localhost` n'est pas joignable depuis le conteneur (`localhost` y désigne le conteneur) :
d'où `SECTEUR_SERVICE_URI=http://host.docker.internal:8010` (et 8011-8013) dans le compose (même
chose pour les autres services, lignes commentées). Sans Docker, ce problème n'existe pas.

⚠️ Le service reçoit alors `Host: host.docker.internal:<port>` : un service Django répond
**400 DisallowedHost** si `host.docker.internal` n'est pas dans son `ALLOWED_HOSTS` (c'est le cas
par défaut pour les 4 services Market dans `Backend/Market/docker-compose.yml`).
En développement, le plus simple est de lancer la gateway **hors Docker** (`.\mvnw spring-boot:run`).

### Activer le JWT (Keycloak)

```powershell
$env:JWT_ENABLED="true"
# $env:KEYCLOAK_JWK_SET_URI="http://localhost:8080/realms/launchpad/protocol/openid-connect/certs"   # défaut
.\mvnw spring-boot:run
```

Les tokens Keycloak (RS256) sont vérifiés avec les clés publiques du realm (JWKS).

Routes **publiques** (sans token) : `/api/auth/**`, toutes les docs (`/api/market/*/docs/**`,
`/api/market/*/schema/**`, `/api/comptable/docs`, `/api/comptable/docs.json`, `/docs/**`), les
health checks (`/api/market/*/health/`, `/api/comptable/health`, `/actuator/health`) et toutes les
requêtes `OPTIONS` (préflight CORS). Sur ces routes, un token invalide est ignoré.

Tout le reste exige un JWT valide, sinon :

```json
401 {"message": "Token manquant ou invalide"}
```

Avec `JWT_ENABLED=false` (défaut), tout est ouvert : pratique pour tester sans Keycloak.

---

## Brancher mon service sur la gateway (marche à suivre pour un membre)

1. **Préfixe** : toutes les routes de votre API commencent par votre préfixe
   (`/api/comptable/…`, `/api/legal/…`). La gateway ne le retire pas : votre service reçoit
   `/api/comptable/factures` tel quel. Idéalement, servez aussi vos docs sous ce préfixe.
2. **Nom Eureka** : enregistrez votre service dans Eureka (`http://localhost:8761/eureka/`)
   sous **exactement** le nom du tableau (`PROFESSIONAL-SERVICE`, `lawyer-client-service`, `LEGAL-SERVICE`…).
   Spring Boot : `spring.application.name` + `spring-cloud-starter-netflix-eureka-client` ;
   Node.js : `eureka-js-client` ; Python : `py-eureka-client` (voir Backend/Market).
3. **Port** : gardez le port du tableau ; s'il change, prévenez pour mettre à jour le profil local.
4. **CORS désactivé dans votre service** : c'est la gateway qui gère le CORS. Si votre service
   ajoute lui aussi des en-têtes `Access-Control-*`, le navigateur peut refuser la réponse
   (la gateway retire les doublons, mais mieux vaut ne pas en envoyer).
5. **Token** : l'en-tête `Authorization: Bearer <token>` vous arrive tel quel ; vous pouvez
   lire les informations de l'utilisateur dans le JWT.
6. **Health check** : exposez un `GET /api/<préfixe>/health` (public via la gateway s'il est listé
   dans `SecurityConfig.PUBLIC_PATHS`).
7. Nom, port ou docs « à confirmer » : envoyez-les pour mettre à jour `application.yml`,
   `application-local.yml` et ce README.

Pour ajouter un service : un bloc dans `routes:` de `application.yml` (id, `uri`, `Path`,
`metadata.service`), sa ligne dans `launchpad.services` (défaut `lb://<NOM>`) et, s'il a un port
connu, dans `application-local.yml`.

---

## Tester avec curl

```bash
# Santé de la gateway et routes chargées
curl http://localhost:8090/actuator/health
curl http://localhost:8090/actuator/gateway/routes

# Services Market via la gateway (même réponse qu'en direct sur les ports 8010-8013)
curl http://localhost:8090/api/market/secteurs/health/
curl http://localhost:8090/api/market/etudes/
curl -X POST http://localhost:8090/api/market/etudes/1/generer-swot/   # -> SWOT-SERVICE

# Identifiant de requête renvoyé par la gateway
curl -i -H "X-Request-Id: test-123" http://localhost:8090/api/market/etudes/health/

# Service absent d'Eureka -> 503 {"service":"PROFESSIONAL-SERVICE","message":"Service indisponible"}
curl -i http://localhost:8090/api/comptable/factures
curl -i http://localhost:8090/api/lawyer/clients
curl -i http://localhost:8090/api/legal/contrats

# Préflight CORS du frontend
curl -i -X OPTIONS http://localhost:8090/api/market/etudes/ \
  -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST"

# Avec JWT_ENABLED=true
curl -i http://localhost:8090/api/market/etudes/                      # 401 {"message":"Token manquant ou invalide"}
curl -i -H "Authorization: Bearer <token>" http://localhost:8090/api/market/etudes/
curl -i http://localhost:8090/api/market/etudes/docs/                 # public
```

Sous PowerShell, utiliser `curl.exe` (et non l'alias `curl`).

---

## Tests

```powershell
.\mvnw clean verify
```

Tests d'intégration (`@SpringBootTest` sur un port aléatoire, faux services MockWebServer) :

| Classe | Vérifie |
|---|---|
| `RoutesTest` | profil eureka par défaut, les 25 routes chargées en `lb://`, ordre des routes Finance et des schémas IA, `/actuator/gateway/routes`, `/actuator/health` |
| `MarketRoutesTest` | chaque chemin `/api/market/...` arrive au bon des 4 services Market (dont `/etudes/<id>/generer-swot/` → SWOT-SERVICE), docs comprises ; l'ancienne route unique n'existe plus |
| `AiRoutesTest` | chaque chemin `/api/ai/...` arrive au bon des 3 services IA, réécriture des docs `/docs/ai/<service>/…`, schéma `/api/ai/schema/` envoyé selon le `Referer` ; l'ancienne route unique `/api/ai/**` n'existe plus |
| `ProxyTest` | relais vers un faux etude-service (profil local) : chemin et query inchangés, `Authorization` transmis, `X-Request-Id`, CORS (en-tête unique, préflight, origine refusée) |
| `ServiceUnavailableTest` | 503 JSON pour un service éteint (URL directe), un `lb://` sans instance et une connexion coupée avant réponse (conteneur Docker en cours d'arrêt), CORS sur le 503 |
| `DocsRewriteTest` | réécriture des docs juridique (`/docs/legal…`) |
| `UserRoutesTest` | User-Service : `/api/auth/**`, docs `/docs/user/…`, schéma choisi par Referer |
| `LawyerRoutesTest` | les 3 services avocat : routage par ressource, docs `/docs/lawyer/<service>/…`, schéma choisi par Referer |
| `JwtSecurityTest` | `JWT_ENABLED=true` avec un faux Keycloak (JWKS) et de vrais JWT RS256 : 401 sans token / token invalide / expiré, accès avec un token valide (transmis tel quel), routes publiques, préflight |

## Structure

```
API-Gateway/
├── src/main/java/com/example/gateway/
│   ├── GatewayApplication.java
│   ├── security/SecurityConfig.java        # JWT Keycloak, routes publiques, CORS, 401 JSON
│   └── web/
│       ├── RequestLoggingFilter.java       # logs + X-Request-Id
│       ├── ServiceUnavailableHandler.java  # 503 JSON "Service indisponible"
│       └── JsonResponses.java
├── src/main/resources/
│   ├── application.yml                     # routes (un bloc par service), CORS, sécurité, actuator
│   ├── application-eureka.yml              # profil par défaut
│   └── application-local.yml               # URL directes
├── src/test/java/com/example/gateway/      # tests (MockWebServer)
├── Dockerfile                              # multi-stage (Maven + JRE 17)
├── docker-compose.yml                      # compose LOCAL (Eureka sur la machine hôte)
└── pom.xml
```
