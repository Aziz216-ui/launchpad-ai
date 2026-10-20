# Diagramme de séquence — Création d'un concurrent

Le Frontend appelle `POST /api/market/concurrents/` (`ConcurrentViewSet.create`, `ConcurrentSerializer`).

![Séquence création concurrent](diagramme-sequence-crud-concurrent.png)

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant F as Frontend
    participant V as ConcurrentViewSet<br/>(views.py)
    participant Ser as ConcurrentSerializer<br/>(serializers.py)
    participant DB as PostgreSQL<br/>(market_db)

    U->>F: Remplit le formulaire « Nouveau concurrent »
    F->>V: POST /api/market/concurrents/<br/>{nom, secteur, prix_moyen, part_de_marche, pays, ...}
    V->>Ser: ConcurrentSerializer(data=...)
    V->>Ser: is_valid(raise_exception=True)
    Ser->>DB: Vérifie que le secteur (id) existe
    DB-->>Ser: résultat
    Ser->>Ser: Validateurs du modèle<br/>prix_moyen ≥ 0<br/>0 ≤ part_de_marche ≤ 100

    alt Données valides
        V->>Ser: save()
        Ser->>DB: INSERT INTO marche_concurrent
        DB-->>Ser: concurrent créé (id, date_creation)
        Ser-->>V: données sérialisées (+ secteur_nom)
        V-->>F: 201 Created + JSON du concurrent
        F-->>U: Affiche le concurrent ajouté
    else Données invalides (ex : part_de_marche = 120, prix_moyen = -5, secteur inconnu)
        Ser-->>V: ValidationError
        V-->>F: 400 Bad Request<br/>{"part_de_marche": ["Assurez-vous que cette valeur est inférieure ou égale à 100."]}
        F-->>U: Affiche les erreurs sous les champs concernés
    end
```

## À retenir

- Les règles de validation sont déclarées **une seule fois** dans le modèle
  (`MinValueValidator`, `MaxValueValidator`) et appliquées automatiquement par le `ModelSerializer`.
- En cas d'erreur, rien n'est écrit en base et l'API renvoie `400` avec un message par champ invalide.
