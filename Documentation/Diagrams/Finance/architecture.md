# Architecture et communication — module Finance

Traits pleins : appels HTTP **synchrones** (gateway, OpenFeign). Traits épais : messages **asynchrones** RabbitMQ
(exchange topic `finance.events`). Pointillés : découverte (Eureka) et clés de vérification des JWT (Keycloak).

```mermaid
flowchart TB
    U[Navigateur<br/>Angular /finance] -->|"HTTPS + JWT"| GW[API Gateway :8090<br/>vérifie le JWT]

    GW -->|"/api/finance/documents/**<br/>/projets/*/documents, /notifications"| DOC
    GW -->|"/api/finance/** (le reste)"| PREV

    subgraph Finance-Service
        PREV[Prevision-Service :8081<br/>prévisions, rôles, avis, IA]
        DOC[Document-Service :8083<br/>documents, exports, certification, notifications]
    end

    DOC -->|"Feign 1 · GET /projets/{id}/synthese<br/>Feign 2 · POST /ia/analyse<br/>Feign 3 · GET /projets/{id}/acces<br/>Feign 4 · GET /previsions/{id}"| PREV
    PREV -->|"Feign 5 · POST /documents<br/>(assistant IA)"| DOC

    PREV --- PDB[(PostgreSQL<br/>prevision_db)]
    DOC --- DDB[(PostgreSQL<br/>document_db)]
    DOC --- FS[(Fichiers PDF/Excel<br/>disque ou MinIO)]
    PREV -->|Spring AI| LLM[(LLM<br/>xAI / Groq)]

    MQ{{RabbitMQ<br/>exchange finance.events}}
    PREV ==>|"finance.prevision.a-valider<br/>finance.prevision.avis"| MQ
    DOC ==>|"finance.document.genere<br/>finance.document.certifie"| MQ
    MQ ==>|"4 queues de notifications"| DOC
    MQ ==>|"finance.document.genere"| IA[Projet-Service IA<br/>diagnostic du projet]

    EUR[Eureka :8761] -.->|découverte| GW & PREV & DOC
    KC[Keycloak] -.->|clés JWKS| GW & PREV & DOC
```

## Points de conception

- **Une base par service** : aucune clé étrangère entre `prevision_db` et `document_db` ; le projet n'est référencé que
  par son identifiant (`projetId`, celui du Projet-Service).
- **Jeton relayé** : sur les appels Feign, le JWT de l'utilisateur est transmis ; le service appelé applique les droits
  de ce même utilisateur.
- **Panne d'un service** : timeouts courts, réponse 503 lisible ; les documents déjà générés restent consultables.
- **Messages** : JSON lisible par un service non Java (le Projet-Service est en Python), publication après commit,
  traitement idempotent.
