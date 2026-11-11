# Config Server — configuration centralisée

Serveur **Spring Cloud Config** de LaunchPad AI (Spring Boot 4.1, Spring Cloud 2025.1, Java 17).
Il sert la configuration des microservices depuis un seul endroit : le dossier
[`config-repo/`](config-repo), versionné dans Git.

| | |
|---|---|
| Port | `8888` (publié sur `127.0.0.1` uniquement) |
| Nom Eureka | `CONFIG-SERVER` |
| Profil | `native` : fichiers lus dans un dossier (pas de dépôt Git distant) |
| Clients | **API Gateway** (`spring.config.import=optional:configserver:...`) |

## Fonctionnement

```
config-repo/
├── application.yml    # commun à TOUS les clients (Eureka, cache du load balancer...)
└── API-GATEWAY.yml    # propre à l'application spring.application.name=API-GATEWAY
```

Au démarrage, un client appelle `GET /{spring.application.name}/{profil}` et reçoit
`application.yml` + `{nom}.yml` (+ `{nom}-{profil}.yml` s'il existe).

**Priorité** des valeurs pour un client : variables d'environnement > Config Server >
`application.yml` embarqué dans le client.

**`optional:`** : si le Config Server est arrêté, le client démarre quand même avec sa propre
configuration (vérifié : la gateway démarre sans lui).

## Consulter la configuration servie

```bash
curl http://localhost:8888/API-GATEWAY/default     # commun + gateway
curl http://localhost:8888/API-GATEWAY/eureka      # avec le profil "eureka"
curl http://localhost:8888/actuator/health
```

Dans les logs du client :

```
ConfigServerConfigDataLoader : Fetching config from server at : http://config-server:8888
ConfigServerConfigDataLoader : Located environment: name=API-GATEWAY, profiles=[default]
```

## Modifier une configuration

1. Modifier ou ajouter un fichier dans `config-repo/`. Pour un nouveau client, le fichier
   s'appelle `<spring.application.name>.yml`, par exemple `PREVISION-SERVICE.yml`.
2. docker-compose monte `config-repo/` en lecture seule dans le conteneur : **pas besoin de
   reconstruire le Config Server**.
3. Redémarrer le client : `docker restart launchpad-api-gateway`.

**Ne jamais mettre de secret** (mot de passe, clé d'API) dans `config-repo/` : il est versionné.
Les secrets restent dans le `.env` racine (non suivi par Git).

## Rendre un autre service Spring client du Config Server

1. Dépendance Maven :
   ```xml
   <dependency>
       <groupId>org.springframework.cloud</groupId>
       <artifactId>spring-cloud-starter-config</artifactId>
   </dependency>
   ```
2. Dans son `application.yml` :
   ```yaml
   spring:
     config:
       import: "optional:configserver:${CONFIG_SERVER_URL:http://localhost:8888}"
   ```
3. Dans `docker-compose.yml` : `CONFIG_SERVER_URL: http://config-server:8888` et
   `depends_on: config-server: {condition: service_healthy}`.
4. Créer `config-repo/<NOM>.yml`.

## Lancer

```bash
docker compose up -d config-server          # avec toute la plateforme (recommandé)

# ou en local (Eureka sur localhost:8761)
mvn spring-boot:run
```

## Tests

```bash
mvn verify      # démarre le serveur (sans Eureka) et vérifie la configuration servie
```

Les tests vérifient que `/API-GATEWAY/default` renvoie bien `API-GATEWAY.yml` + `application.yml`,
qu'un autre service ne reçoit que la configuration commune, et que `/actuator/health` répond UP.
