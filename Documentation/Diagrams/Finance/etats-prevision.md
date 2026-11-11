# États d'une prévision

```mermaid
stateDiagram-v2
    [*] --> EN_ATTENTE : l'entrepreneur crée la prévision<br/>(événement a-valider, motif CREATION)
    EN_ATTENTE --> VALIDEE : le financier valide
    EN_ATTENTE --> REJETEE : le financier rejette<br/>(commentaire obligatoire)
    VALIDEE --> REJETEE : le financier change d'avis
    REJETEE --> VALIDEE : le financier change d'avis
    VALIDEE --> EN_ATTENTE : nouvelles projections différentes<br/>(événement a-valider, motif CHIFFRES_MODIFIES)
    REJETEE --> EN_ATTENTE : nouvelles projections différentes
    VALIDEE --> VALIDEE : mêmes projections régénérées<br/>(avis conservé)
    REJETEE --> REJETEE : mêmes projections régénérées<br/>(le rejet ne s'efface pas)
```

Un document ne peut être **certifié** que si la prévision dont il est tiré est `VALIDEE` **et** que ses chiffres sont
identiques à ceux utilisés à la génération du document.
