# Diagramme de classes — Document-Service

```mermaid
classDiagram
    direction LR

    class DocumentFinancier {
        <<record>>
        UUID id
        Long projetId
        TypeDocument type
        ContenuDocument contenu
        Instant creeLe
        UUID previsionId
        String empreintePrevision
        Certification certification
        +creer(...)$ DocumentFinancier
        +certifier(Certification, EtatPrevision) DocumentFinancier
    }
    class TypeDocument {
        <<enumeration>>
        BUSINESS_PLAN
        BILAN_OUVERTURE
        COMPTE_RESULTAT
        PLAN_TRESORERIE
        RAPPORT_INVESTISSEUR
    }
    class ContenuDocument {
        <<record>>
        String titre
        List~SectionDocument~ sections
    }
    class SectionDocument {
        <<record>>
        String titre
        List~String~ colonnes
        List~LigneDocument~ lignes
        List~String~ notes
    }
    class Certification {
        <<record>>
        String auteur
        String commentaire
        Instant le
    }
    class EtatPrevision {
        <<record>>
        String statut
        String empreinte
    }
    class EmpreintePrevision {
        <<utilitaire>>
        +de(periode, ca, couts, depenses, projections)$ String
    }
    class Notification {
        <<record>>
        UUID cle
        Long projetId
        TypeNotification type
        Destinataire pour
        String message
        +visiblePar(DroitsProjet) boolean
    }

    class GestionDocuments {
        <<service>>
        +genererDocument(projetId, type, tresorerie, avecAnalyse)
        +exporterDocument(id, format)
        +certifierDocument(id, commentaire)
        +supprimerDocument(id)
    }
    class GenerateurDocsFinanciers {
        +calculer(type, projetId, tresorerie) DocumentCalcule
    }
    class ExporteurFinancier {
        <<contexte Strategy>>
    }
    class StrategieExport {
        <<interface>>
    }
    class ControleAcces {
        <<service>>
    }
    class JournalNotifications {
        <<service>>
    }
    class PrevisionDistante {
        <<interface / port>>
        +derniereSynthese(projetId)
        +etat(previsionId) EtatPrevision
    }
    class AccesDistant {
        <<interface / port>>
        +droits(projetId) DroitsProjet
    }
    class AnalyseDistante {
        <<interface / port>>
        +analyser(ContenuDocument) List~String~
    }

    DocumentFinancier --> TypeDocument
    DocumentFinancier *-- ContenuDocument
    ContenuDocument *-- SectionDocument
    DocumentFinancier o-- Certification
    DocumentFinancier ..> EtatPrevision : certifier()
    EtatPrevision ..> EmpreintePrevision

    GestionDocuments --> GenerateurDocsFinanciers
    GestionDocuments --> ExporteurFinancier
    GestionDocuments --> ControleAcces
    GestionDocuments --> PrevisionDistante
    GestionDocuments --> AnalyseDistante
    GenerateurDocsFinanciers --> PrevisionDistante
    ControleAcces --> AccesDistant
    ExporteurFinancier --> StrategieExport
    StrategieExport <|.. ExportPdf
    StrategieExport <|.. ExportExcel
    PrevisionDistante <|.. PrevisionDistanteFeign : Feign
    AccesDistant <|.. AccesDistantFeign : Feign
    AnalyseDistante <|.. AnalyseDistanteFeign : Feign
    JournalNotifications --> Notification
```

Les trois ports `PrevisionDistante`, `AccesDistant` et `AnalyseDistante` sont implémentés par des adaptateurs
**OpenFeign** (package `client`) ; les services métier ne dépendent que des interfaces (règle ArchUnit).
