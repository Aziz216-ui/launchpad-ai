# Séquence — génération puis certification d'un document (communication synchrone, OpenFeign)

Le Document-Service appelle trois fois le Prevision-Service par **OpenFeign**, en relayant le jeton de l'utilisateur :
droits sur le projet, synthèse de la prévision (génération), état de la prévision (certification).

```mermaid
sequenceDiagram
    autonumber
    actor E as Entrepreneur
    actor F as Financier
    participant GW as API Gateway
    participant DOC as Document-Service
    participant PREV as Prevision-Service
    participant DB as document_db
    participant MQ as RabbitMQ (finance.events)

    Note over E,MQ: Génération (propriétaire)
    E->>GW: POST /api/finance/documents {projetId, type}
    GW->>DOC: idem (JWT vérifié)
    DOC->>PREV: Feign GET /projets/{id}/acces (jeton relayé)
    PREV-->>DOC: {ecriture: true}
    DOC->>PREV: Feign GET /projets/{id}/synthese
    PREV-->>DOC: prévision + marges + écart + projections
    DOC->>DOC: tableaux du document + empreinte SHA-256 des chiffres
    DOC->>DB: INSERT document (previsionId, empreinte)
    DOC-->>E: 201 document
    DOC--)MQ: après commit : finance.document.genere

    Note over F,MQ: Certification (financier invité)
    F->>GW: POST /api/finance/documents/{id}/certification
    GW->>DOC: idem
    DOC->>PREV: Feign GET /projets/{id}/acces
    PREV-->>DOC: {validation: true}
    DOC->>PREV: Feign GET /previsions/{previsionId}
    PREV-->>DOC: statut + chiffres actuels
    alt prévision non validée
        DOC-->>F: 400 « doit d'abord être validée »
    else chiffres modifiés depuis la génération (empreinte différente)
        DOC-->>F: 400 « regénérez-le avant de le certifier »
    else validée et chiffres identiques
        DOC->>DB: UPDATE certification (auteur, date, commentaire)
        DOC-->>F: 200 document certifié
        DOC--)MQ: après commit : finance.document.certifie
    end

    Note over DOC,PREV: Prevision-Service arrêté → timeout court → 503 « momentanément indisponible »
```
