# Diagramme de classes — Market-Service

Modèles Django de l'application `marche` (`Backend/Market-Service/marche/models.py`).
Toutes les clés étrangères utilisent `on_delete=CASCADE`, d'où les compositions : supprimer un secteur
supprime ses concurrents, études et tendances ; supprimer une étude supprime ses personas et sa SWOT.
Les liens ManyToMany étude ↔ concurrents / tendances sont de simples associations : supprimer une étude
ne supprime ni les concurrents ni les tendances.

![Diagramme de classes](diagramme-classes.png)

```mermaid
classDiagram
    direction LR

    class Secteur {
        +id : BigAutoField  PK
        +nom : CharField max 100, unique
        +description : TextField
        +date_creation : DateTimeField auto
    }

    class Concurrent {
        +id : BigAutoField  PK
        +nom : CharField max 150
        +secteur : ForeignKey vers Secteur
        +site_web : URLField
        +description : TextField
        +forces : TextField
        +faiblesses : TextField
        +prix_moyen : DecimalField 12,2  min 0
        +part_de_marche : DecimalField 5,2  0 à 100
        +pays : CharField max 100
        +date_creation : DateTimeField auto
    }

    class EtudeMarche {
        +id : BigAutoField  PK
        +projet_id : PositiveIntegerField  index
        +entrepreneur_id : PositiveIntegerField  null, index
        +statut : CharField max 10, choix Statut
        +secteur : ForeignKey vers Secteur
        +titre : CharField max 200
        +taille_marche : DecimalField 15,2  min 0
        +taux_croissance : DecimalField 6,2
        +cible : TextField
        +zone_geographique : CharField max 150
        +hypotheses : TextField
        +description_offre : TextField
        +prix_propose : DecimalField 12,2  min 0, null
        +concurrents : ManyToManyField vers Concurrent
        +tendances : ManyToManyField vers Tendance
        +date_creation : DateTimeField auto
        +date_mise_a_jour : DateTimeField auto
    }

    class Tendance {
        +id : BigAutoField  PK
        +titre : CharField max 200
        +secteur : ForeignKey vers Secteur
        +description : TextField
        +impact : CharField max 10, choix Impact
        +date_creation : DateTimeField auto
    }

    class Persona {
        +id : BigAutoField  PK
        +etude : ForeignKey vers EtudeMarche
        +nom : CharField max 150
        +tranche_age : CharField max 50
        +profession : CharField max 150
        +localisation : CharField max 150
        +revenu_estime : DecimalField 12,2  min 0, null
        +besoins : TextField
        +frustrations : TextField
        +comportement_achat : TextField
        +date_creation : DateTimeField auto
    }

    class ElementSWOT {
        +id : BigAutoField  PK
        +etude : ForeignKey vers EtudeMarche
        +type : CharField max 12, choix Type
        +description : TextField
        +genere_automatiquement : BooleanField
        +date_creation : DateTimeField auto
    }

    class Statut {
        <<enumeration>>
        BROUILLON = brouillon
        FINALISEE = finalisee
    }

    class Impact {
        <<enumeration>>
        POSITIF = positif
        NEGATIF = negatif
        NEUTRE = neutre
    }

    class Type {
        <<enumeration>>
        FORCE = force
        FAIBLESSE = faiblesse
        OPPORTUNITE = opportunite
        MENACE = menace
    }

    Secteur "1" *-- "0..*" Concurrent : concurrents
    Secteur "1" *-- "0..*" EtudeMarche : etudes
    Secteur "1" *-- "0..*" Tendance : tendances
    EtudeMarche "1" *-- "0..*" Persona : personas
    EtudeMarche "1" *-- "0..*" ElementSWOT : swot
    EtudeMarche "0..*" --> "0..*" Concurrent : concurrents
    EtudeMarche "0..*" --> "0..*" Tendance : tendances
    EtudeMarche ..> Statut : statut
    Tendance ..> Impact : impact
    ElementSWOT ..> Type : type

    note for EtudeMarche "projet_id et entrepreneur_id référencent un projet et un utilisateur<br>gérés par d'AUTRES microservices : simples entiers indexés, pas de clé étrangère."
```

## Points clés

| Modèle | Rôle | Tri par défaut |
|---|---|---|
| `Secteur` | Secteur d'activité (FinTech, EdTech…) | `nom` |
| `Concurrent` | Acteur présent dans un secteur | `-part_de_marche`, `nom` |
| `EtudeMarche` | Étude de marché d'un entrepreneur pour un projet : marché cible, hypothèses, offre et prix | `-date_creation` |
| `Tendance` | Tendance observée dans un secteur, avec un impact | `-date_creation` |
| `Persona` | Client type visé par l'offre d'une étude | `id` |
| `ElementSWOT` | Élément de la SWOT d'une étude, saisi à la main ou généré | `type`, `id` |

- Validations portées par le modèle (et reprises par les `ModelSerializer`) :
  `prix_moyen ≥ 0`, `0 ≤ part_de_marche ≤ 100`, `taille_marche ≥ 0`, `prix_propose ≥ 0`, `revenu_estime ≥ 0`.
- `taux_croissance` peut être négatif (marché en recul).
- `genere_automatiquement = true` : élément créé par `POST /etudes/<id>/generer-swot/`, remplacé à chaque
  génération ; les éléments manuels (`false`) sont conservés.
