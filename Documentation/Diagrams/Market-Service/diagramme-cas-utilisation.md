# Diagramme de cas d'utilisation — Market-Service

Mermaid n'a pas de diagramme de cas d'utilisation natif : la version ci-dessous est un `flowchart`
mis en forme comme un diagramme UML. La version UML standard est dans
[diagramme-cas-utilisation.puml](diagramme-cas-utilisation.puml) (PlantUML).

![Cas d'utilisation](diagramme-cas-utilisation.png)

```mermaid
flowchart LR
    EN["👤 Entrepreneur"]
    AD["👤 Administrateur"]
    AI["⚙️ AI-Service<br/>&lt;&lt;système&gt;&gt;"]

    subgraph MS["Market-Service"]
        direction TB
        subgraph ETUDE["Étude de marché"]
            direction TB
            UC7(["Gérer ses études de marché<br/>(créer, consulter, modifier, supprimer un brouillon)"])
            UC8(["Définir le marché cible et les hypothèses"])
            UC2(["Identifier les concurrents"])
            UC4b(["Analyser les tendances"])
            UC9(["Comparer les offres et les prix"])
            UC10(["Définir les personas"])
            UC11(["Évaluer opportunités et menaces"])
            UC12(["Générer / compléter l'analyse SWOT"])
            UC13(["Générer le rapport<br/>(JSON / PDF)"])
            UC14(["Finaliser l'étude"])
        end
        subgraph REF["Données de référence et analyses"]
            direction TB
            UC1(["Gérer les secteurs"])
            UC3(["Gérer les concurrents"])
            UC4(["Gérer les tendances"])
            UC5(["Consulter l'analyse d'un secteur"])
            UC6(["Consulter l'analyse d'un projet"])
        end
    end

    EN --- UC7
    EN --- UC8
    EN --- UC2
    EN --- UC4b
    EN --- UC9
    EN --- UC10
    EN --- UC11
    EN --- UC12
    EN --- UC13
    EN --- UC14
    EN --- UC5

    AD --- UC1
    AD --- UC3
    AD --- UC4
    AD --- UC7

    AI --- UC6
    AI --- UC13

    classDef acteur fill:#ffffff,stroke:#333333,stroke-width:1px,color:#000000
    classDef cas fill:#eef4ff,stroke:#3b6fd6,stroke-width:1px,color:#000000
    classDef casRef fill:#f3f3f3,stroke:#777777,stroke-width:1px,color:#000000
    class EN,AD,AI acteur
    class UC2,UC4b,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14 cas
    class UC1,UC3,UC4,UC5,UC6 casRef
    style MS fill:#fafafa,stroke:#555555,stroke-width:2px
    style ETUDE fill:#f5f9ff,stroke:#3b6fd6
    style REF fill:#f7f7f7,stroke:#999999
```

## Correspondance avec l'API

| Cas d'utilisation | Endpoints |
|---|---|
| Gérer ses études de marché | `GET/POST /api/market/etudes/` (filtres `?entrepreneur_id=`, `?statut=`, `?projet_id=`), `GET/PATCH/DELETE /api/market/etudes/{id}/` |
| Définir le marché cible et les hypothèses | `PATCH /api/market/etudes/{id}/` (`secteur`, `cible`, `zone_geographique`, `taille_marche`, `taux_croissance`, `hypotheses`) |
| Identifier les concurrents | champ `concurrents` (IDs) de l'étude |
| Analyser les tendances | champ `tendances` (IDs) de l'étude, `GET /api/market/tendances/` |
| Comparer les offres et les prix | `GET /api/market/etudes/{id}/comparaison-prix/` |
| Définir les personas | CRUD `/api/market/personas/` (`?etude=`) |
| Évaluer opportunités et menaces | `GET /api/market/etudes/{id}/opportunites-menaces/` |
| Générer / compléter l'analyse SWOT | `POST /api/market/etudes/{id}/generer-swot/`, CRUD `/api/market/swot/` |
| Générer le rapport | `GET /api/market/etudes/{id}/rapport/` et `/rapport/pdf/` |
| Finaliser l'étude | `POST /api/market/etudes/{id}/finaliser/` |
| Gérer les secteurs / concurrents / tendances | `/api/market/secteurs/`, `/api/market/concurrents/`, `/api/market/tendances/` |
| Consulter l'analyse d'un secteur | `GET /api/market/analyse/secteur/{secteur_id}/` |
| Consulter l'analyse d'un projet | `GET /api/market/analyse/projet/{projet_id}/` |

« Gérer » regroupe lister, consulter, créer, modifier et supprimer (CRUD). L'Administrateur peut aussi
le faire depuis l'admin Django (`/admin/`), où personas et SWOT s'éditent directement dans la fiche de l'étude.

> Remarque : la répartition des rôles est celle **prévue** ; le code actuel n'applique pas encore
> de contrôle d'accès (aucune authentification configurée dans DRF). Elle sera assurée par la future
> API Gateway / le User-Service (`entrepreneur_id` identifie déjà le propriétaire d'une étude).
