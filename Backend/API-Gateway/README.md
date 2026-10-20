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
        │              │ routage par préfixe : /api/market/** → lb://MARKET-SERVICE …                │
        └─────────────►└───────────────┬─────────────────────────────────────────────┬──────────────┘
                                       │ 1. « où est MARKET-SERVICE ? »               │ 2. requête relayée
                                       ▼                                             ▼   (chemin inchangé)
                          ┌────────────────────────┐          ┌──────────────────────────────────────┐
                          │ Eureka :8761           │◄─────────│ Market-Service :8005 (MARKET-SERVICE) │
                          │ registre des services  │ enregis- │ Professional-Service :8085            │
                          └────────────────────────┘ trement  │ lawyer-space :8082 · Legal :3003 …    │
                                                              └──────────────────────────────────────┘
```

1. Chaque service s'enregistre dans Eureka sous son nom (ex. `MARKET-SERVICE`).
2. La gateway choisit la route d'après le préfixe (`/api/market/**`), demande à Eureka où se
   trouve le service (`lb://MARKET-SERVICE`) et lui relaie la requête **sans changer le chemin**.
3. Si le service n'est pas enregistré ou ne répond pas : `503 {"service": "MARKET-SERVICE", "message": "Service indisponible"}`.

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
| Market (étude de marché) | `MARKET-SERVICE` | 8005 | `/api/market/**` | `market-service` | `MARKET_SERVICE_URI` | `/api/market/docs/`, `/api/market/schema/` |
| Comptable | `PROFESSIONAL-SERVICE` | 8085 | `/api/comptable/**` | `accounting-service` | `ACCOUNTING_SERVICE_URI` | `/api/comptable/docs`, `/api/comptable/docs.json` |
| Avocat | `lawyer-space` (minuscules) | 8082 | `/api/lawyer/**` | `lawyer-service` | `LAWYER_SERVICE_URI` | `/swagger-ui/**`, `/v3/api-docs/**` (hors préfixe) |
| Juridique | `LEGAL-SERVICE` | 3003 | `/api/legal/**` | `legal-service` | `LEGAL_SERVICE_URI` | `/api/docs`, `/api/docs-json` (hors préfixe) |
| IA | ⚠️ `AI-SERVICE` **à confirmer** | ⚠️ **à confirmer** | `/api/ai/**` | `ai-service` | `AI_SERVICE_URI` | ⚠️ **à confirmer** |
| Finance | ⚠️ `FINANCE-SERVICE` **à confirmer** | ⚠️ **à confirmer** | `/api/finance/**` | `finance-service` | `FINANCE_SERVICE_URI` | ⚠️ **à confirmer** |
| Utilisateurs | ⚠️ `USER-SERVICE` **à confirmer** | ⚠️ **à confirmer** | `/api/auth/**`, `/api/users/**` | `user-service` | `USER_SERVICE_URI` | ⚠️ **à confirmer** |

Routes de documentation supplémentaires (réécriture, pour les docs servies hors préfixe) :

| Route id | Chemin gateway | Chemin envoyé au service |
|---|---|---|
| `lawyer-docs` | `/docs/lawyer/swagger-ui/**` | `/swagger-ui/**` |
| `lawyer-docs` | `/docs/lawyer/v3/api-docs/**` | `/v3/api-docs/**` |
| `legal-docs` | `/docs/legal/**` | `/api/docs/**` |
| `legal-docs-json` | `/docs/legal-json` | `/api/docs-json` |

Les routes juridiques `/docs/legal…` sont à supprimer si le Legal-Service passe ses docs sous
`/api/legal/docs` (elles passeront alors par la route métier).

## Où trouver la doc de chaque service via la gateway

| Service | Swagger UI | Définition OpenAPI |
|---|---|---|
| Market | http://localhost:8090/api/market/docs/ | http://localhost:8090/api/market/schema/ |
| Comptable | http://localhost:8090/api/comptable/docs | http://localhost:8090/api/comptable/docs.json |
| Avocat | http://localhost:8090/docs/lawyer/swagger-ui/index.html | http://localhost:8090/docs/lawyer/v3/api-docs |
| Juridique | http://localhost:8090/docs/legal | http://localhost:8090/docs/legal-json |
| IA | ⚠️ à confirmer | ⚠️ à confirmer |
| Finance | ⚠️ à confirmer | ⚠️ à confirmer |
| Utilisateurs | ⚠️ à confirmer | ⚠️ à confirmer |

> Avocat (springdoc) : la page Swagger UI charge sa configuration à une adresse absolue
> (`/v3/api-docs/swagger-config`). Si la page reste vide via la gateway, ouvrir la définition
> directement (`/docs/lawyer/v3/api-docs`) ; la solution durable est de servir les docs sous
> `/api/lawyer/…` (`springdoc.swagger-ui.path` et `springdoc.api-docs.path`).

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
- **local** : sans Eureka, URL directes `http://localhost:<port>` pour Market (8005),
  Comptable (8085), Avocat (8082) et Juridique (3003). IA, Finance et Utilisateurs n'ont pas
  encore de port confirmé : ils répondent 503 tant que `AI_SERVICE_URI`, `FINANCE_SERVICE_URI`
  ou `USER_SERVICE_URI` n'est pas défini.

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
d'où `MARKET_SERVICE_URI=http://host.docker.internal:8005` dans le compose (même chose pour
les autres services, lignes commentées). Sans Docker, ce problème n'existe pas.

⚠️ Le service reçoit alors `Host: host.docker.internal:8005` : le Market-Service (Django) répond
**400 DisallowedHost** tant que `host.docker.internal` n'est pas dans son `ALLOWED_HOSTS`.
En développement, le plus simple est de lancer la gateway **hors Docker** (`.\mvnw spring-boot:run`).

### Activer le JWT (Keycloak)

```powershell
$env:JWT_ENABLED="true"
# $env:KEYCLOAK_JWK_SET_URI="http://localhost:8080/realms/launchpad/protocol/openid-connect/certs"   # défaut
.\mvnw spring-boot:run
```

Les tokens Keycloak (RS256) sont vérifiés avec les clés publiques du realm (JWKS).

Routes **publiques** (sans token) : `/api/auth/**`, toutes les docs (`/api/market/docs/**`,
`/api/market/schema/**`, `/api/comptable/docs`, `/api/comptable/docs.json`, `/docs/**`), les
health checks (`/api/market/health/`, `/api/comptable/health`, `/actuator/health`) et toutes les
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
   sous **exactement** le nom du tableau (`PROFESSIONAL-SERVICE`, `lawyer-space`, `LEGAL-SERVICE`…).
   Spring Boot : `spring.application.name` + `spring-cloud-starter-netflix-eureka-client` ;
   Node.js : `eureka-js-client` ; Python : `py-eureka-client` (voir Market-Service).
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

# Market-Service via la gateway (même réponse qu'en direct sur le port 8005)
curl http://localhost:8090/api/market/health/
curl http://localhost:8090/api/market/etudes/

# Identifiant de requête renvoyé par la gateway
curl -i -H "X-Request-Id: test-123" http://localhost:8090/api/market/health/

# Service absent d'Eureka -> 503 {"service":"PROFESSIONAL-SERVICE","message":"Service indisponible"}
curl -i http://localhost:8090/api/comptable/factures
curl -i http://localhost:8090/api/lawyer/dossiers
curl -i http://localhost:8090/api/legal/contrats

# Préflight CORS du frontend
curl -i -X OPTIONS http://localhost:8090/api/market/etudes/ \
  -H "Origin: http://localhost:4200" -H "Access-Control-Request-Method: POST"

# Avec JWT_ENABLED=true
curl -i http://localhost:8090/api/market/etudes/                      # 401 {"message":"Token manquant ou invalide"}
curl -i -H "Authorization: Bearer <token>" http://localhost:8090/api/market/etudes/
curl -i http://localhost:8090/api/market/docs/                        # public
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
| `RoutesTest` | profil eureka par défaut, les 10 routes chargées en `lb://`, `/actuator/gateway/routes`, `/actuator/health` |
| `ProxyTest` | relais vers un faux Market-Service (profil local) : chemin et query inchangés, `Authorization` transmis, `X-Request-Id`, CORS (en-tête unique, préflight, origine refusée) |
| `ServiceUnavailableTest` | 503 JSON pour un service éteint (URL directe) et pour un `lb://` sans instance, CORS sur le 503 |
| `DocsRewriteTest` | réécriture des docs avocat (`/docs/lawyer/…`) et juridique (`/docs/legal…`) |
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
