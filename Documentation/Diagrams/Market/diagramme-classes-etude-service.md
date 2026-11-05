# Diagramme de classes — etude-service

Base `etude_db`. `Persona` garde une clé étrangère vers `EtudeMarche` (même service). Le secteur,
les concurrents et les tendances sont des **identifiants** vérifiés et lus par appels REST.

![Classes etude-service](diagramme-classes-etude-service.png)

```mermaid
classDiagram
    direction LR
    class EtudeMarche {
        +BigAutoField id
        +PositiveIntegerField projet_id
        +PositiveIntegerField entrepreneur_id
        +CharField statut «brouillon, finalisee»
        +PositiveIntegerField secteur_id «réf. SECTEUR-SERVICE»
        +JSONField concurrent_ids «réf. CONCURRENT-SERVICE»
        +JSONField tendance_ids «réf. SECTEUR-SERVICE»
        +CharField titre
        +TextField hypotheses
        +TextField description_offre
        +DecimalField prix_propose
        +DecimalField taille_marche
        +DecimalField taux_croissance
        +TextField cible
        +CharField zone_geographique
        +DateTimeField date_creation
        +DateTimeField date_mise_a_jour
    }
    class Persona {
        +BigAutoField id
        +ForeignKey etude
        +CharField nom
        +CharField tranche_age
        +CharField profession
        +CharField localisation
        +DecimalField revenu_estime
        +TextField besoins
        +TextField frustrations
        +TextField comportement_achat
        +DateTimeField date_creation
    }
    class ServicesEtude {
        <<services/etude.py et analyse.py>>
        +comparer_prix(etude) dict
        +evaluer_opportunites_menaces(etude) dict
        +evaluer_potentiel(etude, niveau, prix, om) dict
        +generer_rapport(etude) dict
        +analyser_projet(projet_id) dict
    }
    class SecteurClient {
        <<client REST>>
        +service = SECTEUR-SERVICE
        +nom(id) / noms(ids)
        +tendances(ids, secteur) list
    }
    class ConcurrentClient {
        <<client REST>>
        +service = CONCURRENT-SERVICE
        +list(ids) / du_secteur(id)
    }
    class SwotClient {
        <<client REST>>
        +service = SWOT-SERVICE
        +de_l_etude(id) list
        +apercu(id) list
        +supprimer_pour_etude(id)
    }
    EtudeMarche "1" *-- "0..*" Persona : personas
    ServicesEtude ..> EtudeMarche
    ServicesEtude ..> SecteurClient
    ServicesEtude ..> ConcurrentClient
    ServicesEtude ..> SwotClient
```
