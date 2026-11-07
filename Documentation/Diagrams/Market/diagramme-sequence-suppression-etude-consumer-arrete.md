# Diagramme de séquence — Suppression d'une étude avec swot-consumer arrêté

L'étude est supprimée immédiatement ; l'événement `etude.supprimee` attend dans la queue
durable tant que swot-consumer est arrêté, puis il est traité à son redémarrage.

![Séquence suppression étude, consumer arrêté](diagramme-sequence-suppression-etude-consumer-arrete.png)

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant GW as API Gateway :8090
    participant E as etude-service :8012
    participant EDB as etude_db
    participant X as Exchange<br/>market.events
    participant Q as Queue<br/>swot.etude-supprimee
    participant C as swot-consumer
    participant SDB as swot_db

    Note over C: docker stop swot-consumer<br/>(0 consumer sur la queue)

    U->>GW: DELETE /api/market/etudes/4/
    GW->>E: DELETE /api/market/etudes/4/ (ETUDE-SERVICE via Eureka)
    E->>EDB: DELETE étude 4 et ses personas
    EDB-->>E: COMMIT
    E->>X: publish (après le commit)<br/>routing key etude.supprimee<br/>{message_id, event, occurred_at, data: {etude_id: 4}}<br/>delivery_mode=2
    X->>Q: binding etude.supprimee
    Note over Q: 1 message en attente<br/>(visible sur http://localhost:15672)
    E-->>GW: 204 No Content
    GW-->>U: 204 (immédiat, sans attendre swot-service)

    Note over SDB: les éléments SWOT de l'étude 4<br/>existent encore

    Note over C: docker start swot-consumer
    C->>Q: connexion, basic_consume (prefetch_count=1)
    Q->>C: message etude.supprimee (etude_id=4)
    C->>SDB: message_id déjà traité ?
    SDB-->>C: non
    C->>SDB: DELETE éléments SWOT de l'étude 4<br/>+ enregistre message_id (même transaction)
    SDB-->>C: COMMIT
    C->>Q: basic_ack
    Note over Q: 0 message : queue vidée
    Note over C: [CONSUMER] swot.etude-supprimee etude_id=4 -> OK (4 élément(s) supprimé(s))

    opt Le même message est livré une 2e fois
        Q->>C: message etude.supprimee (même message_id)
        C->>SDB: message_id déjà traité ?
        SDB-->>C: oui
        C->>Q: basic_ack (ignoré, rien n'est rejoué)
    end
```

## À retenir

- La suppression d'une étude ne dépend plus de swot-service (avant : appel REST synchrone).
- Le message est **persistant** et la queue **durable** : il n'est pas perdu tant qu'il n'est pas acquitté.
- L'ack n'est envoyé qu'**après** le commit du traitement : un consumer qui tombe en plein
  traitement laisse le message dans la queue.
