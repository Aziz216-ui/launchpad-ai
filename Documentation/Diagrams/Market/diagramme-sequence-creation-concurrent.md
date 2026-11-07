# Diagramme de séquence — Création d'un concurrent avec vérification du secteur via Eureka

`POST /api/market/concurrents/` : la gateway trouve CONCURRENT-SERVICE dans Eureka, puis
concurrent-service trouve SECTEUR-SERVICE dans Eureka pour vérifier que le secteur existe.

![Séquence création concurrent](diagramme-sequence-creation-concurrent.png)

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant F as Frontend
    participant GW as API Gateway :8090
    participant EU as Eureka :8761
    participant C as concurrent-service :8011<br/>(ConcurrentSerializer)
    participant SC as SecteurClient<br/>(clients/)
    participant S as secteur-service :8010
    participant CDB as concurrent_db

    U->>F: Remplit « Nouveau concurrent »
    F->>GW: POST /api/market/concurrents/<br/>{nom, secteur_id, prix_moyen, part_de_marche, pays}
    GW->>EU: instances de CONCURRENT-SERVICE ?
    EU-->>GW: localhost:8011 (UP)
    GW->>C: POST /api/market/concurrents/ (chemin inchangé)
    C->>C: Validateurs du modèle<br/>prix_moyen ≥ 0, 0 ≤ part ≤ 100
    C->>SC: exists(secteur_id)
    SC->>EU: GET /eureka/apps/SECTEUR-SERVICE<br/>(py-eureka-client, cache 15 s)
    alt Eureka connaît une instance UP
        EU-->>SC: localhost:8010
    else Eureka désactivé ou sans instance
        SC->>SC: repli sur SECTEUR_SERVICE_URL
    end
    SC->>S: GET /api/market/secteurs/{id}/ (timeout 3 s)

    alt Secteur trouvé
        S-->>SC: 200 {id, nom, ...}
        SC-->>C: True
        C->>CDB: INSERT concurrent (secteur_id)
        CDB-->>C: id
        C-->>GW: 201 {..., secteur, secteur_id, secteur_nom}
        GW-->>F: 201 Created
    else Secteur absent
        S-->>SC: 404
        SC-->>C: False (RessourceIntrouvable)
        C-->>GW: 400 {"secteur_id": ["Secteur introuvable"]}
        GW-->>F: 400 Bad Request
    else secteur-service arrêté
        S--xSC: connexion refusée ou timeout
        SC->>S: nouvelle tentative (adresse relue dans Eureka)
        S--xSC: échec
        SC-->>C: ServiceIndisponible
        C-->>GW: 503 {"service": "SECTEUR-SERVICE",<br/>"message": "Service indisponible"}
        GW-->>F: 503
    end
```

## À retenir

- Deux découvertes Eureka : la gateway trouve le concurrent-service, puis le concurrent-service
  trouve le secteur-service. Aucune adresse n'est écrite en dur (sauf l'URL de repli).
- Rien n'est écrit en base tant que le secteur n'a pas été confirmé par SECTEUR-SERVICE.
