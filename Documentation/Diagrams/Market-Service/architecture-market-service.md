# Architecture — Market-Service dans LaunchPad AI

Vue d'ensemble de la place du Market-Service dans l'architecture microservices du projet.
Les services en gris sont ceux des autres membres du groupe (contexte uniquement).

![Architecture](architecture-market-service.png)

```mermaid
flowchart LR
    FE["🖥️ Frontend"]
    AIS["🤖 AI-Service"]
    GW["API Gateway<br/>(futur)"]

    subgraph MKT["Market-Service — Django REST · port 8005"]
        direction TB
        API["API REST /api/market/<br/>secteurs · concurrents · tendances<br/>etudes · personas · swot<br/>etudes/{id}/rapport · rapport/pdf<br/>analyse/secteur · analyse/projet · health"]
        SW["Swagger /api/market/docs/<br/>Admin /admin/"]
        SRV["services/<br/>analyse · étude de marché<br/>SWOT · rapport PDF (reportlab)"]
        API --> SRV
    end

    DB[("PostgreSQL 16<br/>market_db<br/>(port hôte 5433)")]

    subgraph AUTRES["Autres services du groupe"]
        direction TB
        US["User-Service"]
        FS["Finance-Service"]
        LS["Legal-Service"]
        PS["Professional-Service"]
    end

    FE -->|HTTP / JSON| GW
    AIS -->|HTTP / JSON| GW
    GW -->|/api/market/*| API
    AIS -.->|appel direct possible<br/>http://market-service:8005| API
    SRV -->|ORM Django| DB
    GW -.-> AUTRES

    classDef market fill:#e8f1ff,stroke:#2f5fb3,stroke-width:2px,color:#000000
    classDef client fill:#ffffff,stroke:#333333,stroke-width:1px,color:#000000
    classDef futur fill:#ffffff,stroke:#333333,stroke-width:1px,stroke-dasharray:5 5,color:#000000
    classDef bdd fill:#fff7e0,stroke:#b38600,stroke-width:1px,color:#000000
    classDef gris fill:#eeeeee,stroke:#9e9e9e,stroke-width:1px,color:#777777

    class API,SW,SRV market
    class FE,AIS client
    class GW futur
    class DB bdd
    class US,FS,LS,PS gris
    style AUTRES fill:#f7f7f7,stroke:#bdbdbd,color:#777777
    style MKT fill:#f5f9ff,stroke:#2f5fb3,stroke-width:2px
```

## À retenir

- Le Market-Service possède **sa propre base PostgreSQL** (`market_db`) : aucun autre service n'y accède
  directement, tout passe par l'API REST.
- Les projets et les entrepreneurs sont gérés ailleurs : le Market-Service ne stocke que `projet_id` et
  `entrepreneur_id` (sans clé étrangère).
- Le rapport d'étude de marché est produit en JSON et en PDF (reportlab) par le service lui-même :
  aucun service externe n'est nécessaire.
- En Docker, PostgreSQL écoute sur 5432 dans le réseau interne et est exposé sur **5433** côté machine.
