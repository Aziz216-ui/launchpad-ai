# Diagramme de classes — concurrent-service

Base `concurrent_db`. Le secteur n'est plus une clé étrangère : `secteur_id` est un entier
vérifié par `SecteurClient` (appel REST à SECTEUR-SERVICE).

![Classes concurrent-service](diagramme-classes-concurrent-service.png)

```mermaid
classDiagram
    direction LR
    class Concurrent {
        +BigAutoField id
        +CharField nom
        +PositiveIntegerField secteur_id «réf. SECTEUR-SERVICE»
        +URLField site_web
        +TextField description
        +TextField forces
        +TextField faiblesses
        +DecimalField prix_moyen «≥ 0»
        +DecimalField part_de_marche «0 à 100»
        +CharField pays
        +DateTimeField date_creation
    }
    class ConcurrentSerializer {
        +secteur, secteur_id
        +secteur_nom «lu sur SECTEUR-SERVICE»
        +validate(attrs) «400 Secteur introuvable»
    }
    class ServiceClient {
        <<clients/base.py>>
        +service
        +ressource
        +adresse() str «Eureka puis URL directe»
        +requete(chemin, params, methode)
        +get(id) dict
        +exists(id) bool
        +list(ids, filtres) list
    }
    class SecteurClient {
        <<client REST>>
        +service = SECTEUR-SERVICE
        +noms(ids) dict
    }
    ServiceClient <|-- SecteurClient
    ConcurrentSerializer ..> Concurrent
    ConcurrentSerializer ..> SecteurClient : exists(secteur_id), noms(ids)
```
