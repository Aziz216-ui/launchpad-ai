# Séquence — avis du financier et notifications (communication asynchrone, RabbitMQ)

Le Prevision-Service publie ses événements **après le commit** de la transaction sur l'exchange topic
`finance.events` ; le Document-Service les consomme (une queue par type) et produit les notifications, filtrées
ensuite selon le rôle de l'utilisateur sur le projet.

```mermaid
sequenceDiagram
    autonumber
    actor F as Financier
    actor E as Entrepreneur
    participant PREV as Prevision-Service
    participant PDB as prevision_db
    participant MQ as RabbitMQ<br/>exchange finance.events
    participant DOC as Document-Service<br/>(consommateurs)
    participant J as JournalNotifications

    F->>PREV: POST /previsions/{id}/avis {REJETEE, "Coûts sous-estimés"}
    PREV->>PREV: ControleAcces : financier invité ?
    PREV->>PDB: UPDATE statut_validation = REJETEE
    PREV-->>F: 200 prévision rejetée
    PREV--)MQ: après commit : finance.prevision.avis {evenementId, statut, commentaire}
    MQ--)DOC: queue finance.notifications.prevision-avis
    DOC->>J: enregistrer(AvisPrevision) — ignoré si evenementId déjà vu
    J->>J: notification pour = PROPRIETAIRE

    E->>DOC: GET /projets/{id}/notifications
    DOC-->>E: « Votre prévision 2026 a été rejetée par … : Coûts sous-estimés »

    Note over E,J: L'entrepreneur corrige : nouvelles projections différentes
    E->>PREV: POST /previsions/{id}/projections
    PREV->>PDB: projections remplacées, statut = EN_ATTENTE
    PREV--)MQ: finance.prevision.a-valider {motif: CHIFFRES_MODIFIES}
    MQ--)DOC: queue finance.notifications.prevision-a-valider
    DOC->>J: notification pour = TOUS « a changé : nouvel avis »

    Note over PREV,MQ: RabbitMQ arrêté : l'avis reste enregistré, l'erreur est journalisée (pas de blocage)
    Note over MQ,DOC: Échec de traitement : 3 tentatives puis rejet du message
```
