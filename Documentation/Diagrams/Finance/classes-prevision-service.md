# Diagramme de classes — Prevision-Service

Modèle métier (`domain`, Java pur), cas d'usage (`service`) et ports de persistance (`repository`). Les entités JPA
(`entities`) ne sont manipulées que par les adaptateurs `*RepositoryJpa` (règle vérifiée par ArchUnit).

```mermaid
classDiagram
    direction LR

    class PrevisionFinanciere {
        <<record>>
        UUID id
        Long projetId
        String periode
        BigDecimal chiffreAffaires
        BigDecimal coutsDirects
        BigDecimal depenses
        Instant creeLe
        List~ProjectionFinanciere~ projections
        ValidationPrevision validation
        +creer(...)$ PrevisionFinanciere
        +calculerResultat() BigDecimal
        +avecProjections(List) PrevisionFinanciere
        +avecValidation(ValidationPrevision) PrevisionFinanciere
    }
    class ProjectionFinanciere {
        <<record>>
        int annee
        BigDecimal chiffreAffaires
        BigDecimal depenses
        BigDecimal marge
        +memesChiffresQue(ProjectionFinanciere) boolean
    }
    class ValidationPrevision {
        <<record>>
        StatutValidation statut
        String commentaire
        String auteur
        Instant le
        +avis(decision, commentaire, auteur, le)$ ValidationPrevision
    }
    class StatutValidation {
        <<enumeration>>
        EN_ATTENTE
        VALIDEE
        REJETEE
    }
    class MembreProjet {
        <<record>>
        UUID id
        Long projetId
        RoleProjet role
        String utilisateurId
        String email
        +proprietaire(projetId, Utilisateur)$
        +financier(projetId, email)$
    }
    class RoleProjet {
        <<enumeration>>
        PROPRIETAIRE
        FINANCIER
        ADMIN
        AUCUN
    }
    class DroitsProjet {
        <<record>>
        Long projetId
        RoleProjet role
        boolean lecture
        boolean ecriture
        boolean validation
    }
    class PrevisionAValider {
        <<record / événement>>
        UUID evenementId
        UUID previsionId
        Long projetId
        String motif
    }
    class AvisPrevision {
        <<record / événement>>
        UUID evenementId
        UUID previsionId
        StatutValidation statut
        String commentaire
    }

    class GestionPrevisions {
        <<service>>
        +creerPrevision(...)
        +genererProjections(id, tauxCa, tauxDepenses, horizon)
        +donnerAvis(id, decision, commentaire)
        +consulterSynthese(projetId)
    }
    class ControleAcces {
        <<service>>
        +droits(projetId) DroitsProjet
        +exigerLecture(projetId)
        +exigerEcritureEtReserver(projetId)
        +exigerValidation(projetId) String
    }
    class GestionEquipe {
        <<service>>
        +inviterFinancier(projetId, email)
        +retirerFinancier(projetId, email)
        +mesProjets() List~ProjetAccessible~
    }
    class PrevisionRepository {
        <<interface / port>>
    }
    class MembreProjetRepository {
        <<interface / port>>
    }
    class DocumentDistant {
        <<interface / port>>
        +genererDocument(projetId, type) UUID
    }
    class PublicateurEvenementsPrevision {
        <<RabbitMQ>>
    }

    PrevisionFinanciere "1" *-- "0..10" ProjectionFinanciere
    PrevisionFinanciere "1" *-- "1" ValidationPrevision
    ValidationPrevision --> StatutValidation
    MembreProjet --> RoleProjet
    DroitsProjet --> RoleProjet

    GestionPrevisions --> PrevisionRepository
    GestionPrevisions --> ControleAcces
    GestionPrevisions ..> PrevisionAValider : publie
    GestionPrevisions ..> AvisPrevision : publie
    GestionEquipe --> MembreProjetRepository
    GestionEquipe --> ControleAcces
    ControleAcces --> MembreProjetRepository
    PublicateurEvenementsPrevision ..> PrevisionAValider : envoie après commit
    PublicateurEvenementsPrevision ..> AvisPrevision : envoie après commit
    DocumentDistant <|.. DocumentDistantFeign : adaptateur Feign
```

Le `ModelePrevisionnel` calcule les projections via une `StrategieProjection` (patron **Strategy**, implémentation
`CroissanceParTaux`). L'IA (`AssistantFinancier`, `CommentateurEcart`, `RedacteurIA`) passe par le port `ClientLLM`.
