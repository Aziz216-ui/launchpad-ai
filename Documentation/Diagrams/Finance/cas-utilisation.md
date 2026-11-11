# Cas d'utilisation — module Finance

Deux rôles sur un même projet : l'**entrepreneur** (propriétaire, produit les données) et le **financier invité**
(relecteur, valide). Un administrateur a tous les droits.

```mermaid
flowchart LR
    E((Entrepreneur<br/>propriétaire))
    F((Financier<br/>invité))

    subgraph Finance
        UC1[Choisir / créer un projet]
        UC2[Saisir une prévision]
        UC3[Générer des projections]
        UC4[Générer un document PDF / Excel]
        UC5[Inviter / retirer un financier]
        UC6[Interroger l'assistant IA]
        UC7[Consulter marges, écart, projections]
        UC8[Exporter un document]
        UC9[Commentaire IA de l'écart]
        UC10[Valider / rejeter une prévision]
        UC11[Certifier un document]
        UC12[Consulter ses notifications]
    end

    E --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6
    E --> UC7 & UC8 & UC9 & UC12
    F --> UC7 & UC8 & UC9 & UC12
    F --> UC10 & UC11

    UC11 -.->|"include : prévision validée<br/>et chiffres inchangés"| UC10
```

| Cas | Entrepreneur | Financier |
|---|:-:|:-:|
| Saisir prévisions, projections, documents ; inviter ; assistant IA | ✅ | ❌ (403) |
| Consulter, exporter, commentaire IA, notifications | ✅ | ✅ |
| Valider / rejeter une prévision, certifier un document | ❌ (403) | ✅ |
