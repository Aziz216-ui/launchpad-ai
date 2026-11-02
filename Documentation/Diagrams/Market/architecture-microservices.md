# Architecture — Étude de marché en 4 microservices

Les 4 services Django de `Backend/Market/` : chacun a sa base PostgreSQL, s'enregistre dans
Eureka et appelle les autres services par leur **nom Eureka** (package `clients/`).
L'API Gateway route les URLs publiques `/api/market/...` vers le bon service.

![Architecture](architecture-microservices.png)

```mermaid
flowchart TB
    FE["Frontend Angular<br/>:4200"]
    AI["AI-Service<br/>(analyse/projet)"]
    GW["API Gateway :8090<br/>Spring Cloud Gateway<br/>routes lb://NOM-EUREKA"]
    EU[("Eureka :8761<br/>registre des services")]

    subgraph MARKET["Backend/Market — docker compose (réseau market-net)"]
        direction LR
        S["secteur-service :8010<br/>SECTEUR-SERVICE<br/>Secteur, Tendance"]
        C["concurrent-service :8011<br/>CONCURRENT-SERVICE<br/>Concurrent"]
        E["etude-service :8012<br/>ETUDE-SERVICE<br/>EtudeMarche, Persona"]
        W["swot-service :8013<br/>SWOT-SERVICE<br/>ElementSWOT"]
        SDB[("secteur_db<br/>:5440")]
        CDB[("concurrent_db<br/>:5441")]
        EDB[("etude_db<br/>:5442")]
        WDB[("swot_db<br/>:5443")]
    end

    FE --> GW
    AI --> GW
    GW -- "/secteurs/** /tendances/**<br/>/analyse/secteur/**" --> S
    GW -- "/concurrents/**" --> C
    GW -- "/etudes/*/generer-swot/**<br/>/swot/**" --> W
    GW -- "/etudes/** /personas/**<br/>/analyse/projet/**" --> E
    GW -. "résolution lb://" .-> EU

    S --- SDB
    C --- CDB
    E --- EDB
    W --- WDB

    C -- "SecteurClient<br/>existe ? nom ?" --> S
    S -- "ConcurrentClient<br/>concurrents du secteur" --> C
    E -- "SecteurClient<br/>secteur, tendances" --> S
    E -- "ConcurrentClient<br/>?ids=" --> C
    E -- "SwotClient<br/>SWOT, aperçu" --> W
    W -- "EtudeClient<br/>étude, prix, O/M" --> E

    S & C & E & W -. "enregistrement + résolution<br/>(py-eureka-client)" .-> EU

    classDef svc fill:#e3f2fd,stroke:#2f5fb3,color:#000
    classDef db fill:#fff3e0,stroke:#e65100,color:#000
    classDef infra fill:#e8f5e9,stroke:#2e7d32,color:#000
    class S,C,E,W svc
    class SDB,CDB,EDB,WDB db
    class GW,EU infra
```

## À retenir

- **Une base par service** : aucune table partagée, aucune clé étrangère entre services.
- Les flèches pleines entre services sont des **appels REST** : l'adresse est lue dans Eureka
  par le nom du service (repli sur `<NOM>_SERVICE_URL`), timeout 3 s, une nouvelle tentative.
- Service appelé arrêté → `503 {"service": "<NOM>", "message": "Service indisponible"}`.
