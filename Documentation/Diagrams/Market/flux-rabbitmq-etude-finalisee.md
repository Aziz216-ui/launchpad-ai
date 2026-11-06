# Flux RabbitMQ — événement etude.finalisee

Producer → Exchange → Queue → Consumer : la finalisation d'une étude déclenche la génération
automatique de sa SWOT, sans que l'utilisateur attende swot-service.

![Flux etude.finalisee](flux-rabbitmq-etude-finalisee.png)

```mermaid
flowchart TB
    U(["Frontend<br/>POST /etudes/4/finaliser/"])

    subgraph P["Producer : etude-service :8012"]
        V["EtudeMarcheViewSet.finaliser<br/>statut = finalisee<br/>COMMIT"]
        PUB["publier('etude.finalisee', {etude_id: 4})<br/>transaction.on_commit<br/>JSON persistant, message_id"]
        OUT[("outbox<br/>si RabbitMQ<br/>indisponible")]
    end

    subgraph R["RabbitMQ :5672 (interface :15672)"]
        X{{"Exchange market.events<br/>type topic, durable"}}
        Q1[["Queue swot.etude-finalisee<br/>durable<br/>binding : etude.finalisee"]]
        Q2[["Queue swot.etude-supprimee<br/>binding : etude.supprimee"]]
        DLX{{"Exchange market.dlx"}}
        DLQ[["Queue market.dlq<br/>(dead-letter)"]]
    end

    subgraph C["Consumer : swot-consumer (python manage.py consume_events)"]
        H["handler etude_finalisee<br/>idempotence par message_id<br/>generer_swot(4)"]
        DB[("swot_db<br/>éléments SWOT<br/>(manuels conservés)")]
    end

    E["ETUDE-SERVICE<br/>(REST via Eureka)<br/>étude, prix, O/M"]

    U --> V --> PUB
    PUB -- "routing key etude.finalisee" --> X
    PUB -. "échec" .-> OUT
    OUT -. "relais toutes les 10 s" .-> X
    X -- "etude.finalisee" --> Q1
    X -. "etude.supprimee" .-> Q2
    Q1 -- "prefetch 1" --> H
    H -- "ack après traitement" --> Q1
    H --> DB
    H -- "lecture synchrone" --> E
    Q1 -. "3 échecs : nack" .-> DLX --> DLQ
    V -- "200 immédiat" --> U

    classDef prod fill:#e3f2fd,stroke:#2f5fb3,color:#000
    classDef broker fill:#fff3e0,stroke:#e65100,color:#000
    classDef cons fill:#e8f5e9,stroke:#2e7d32,color:#000
    classDef err fill:#ffebee,stroke:#c62828,color:#000
    class V,PUB prod
    class X,Q1,Q2 broker
    class H,DB cons
    class OUT,DLX,DLQ err
```

## À retenir

- Le producer publie **sur l'exchange** avec la routing key `etude.finalisee` ; c'est le
  binding de la queue `swot.etude-finalisee` qui y amène le message.
- La réponse HTTP (200) n'attend pas la génération : la SWOT apparaît quelques secondes plus tard.
- Échec de traitement : 3 tentatives, puis `market.dlq`. RabbitMQ arrêté : outbox, renvoi automatique.
