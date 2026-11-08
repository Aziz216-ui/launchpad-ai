# Diagramme de séquence — Génération de la SWOT d'une étude

L'entrepreneur demande la SWOT automatique de son étude : `POST /api/market/etudes/<id>/generer-swot/`
(`EtudeMarcheViewSet.generer_swot` → `services.generer_swot`, dans `marche/services/etude.py`).

![Séquence génération SWOT](diagramme-sequence-generer-swot.png)

```mermaid
sequenceDiagram
    autonumber
    actor E as Entrepreneur
    participant F as Frontend
    participant V as EtudeMarcheViewSet<br/>(views.py)
    participant S as services/etude.py
    participant DB as PostgreSQL<br/>(market_db)

    E->>F: Clique sur « Générer la SWOT »
    F->>V: POST /api/market/etudes/{id}/generer-swot/
    V->>DB: get_object() : étude {id}

    alt Étude inexistante
        DB-->>V: aucune ligne
        V-->>F: 404 Not Found
    else Étude trouvée
        DB-->>V: étude
        V->>S: generer_swot(etude)
        Note over S,DB: transaction.atomic
        S->>DB: DELETE éléments SWOT de l'étude<br/>où genere_automatiquement = true
        Note right of DB: les éléments saisis à la main<br/>sont conservés

        S->>S: calculer_elements_swot(etude)
        S->>DB: concurrents, tendances et personas de l'étude
        DB-->>S: données de l'étude
        Note right of S: Forces / faiblesses (internes) :<br/>prix économique ou aligné → force<br/>prix premium → faiblesse<br/>aucun persona → faiblesse « Cible clients non définie »<br/>aucun concurrent, offre non décrite → faiblesse
        S->>S: evaluer_opportunites_menaces(etude)
        Note right of S: Opportunités / menaces (externes) :<br/>tendance positive → opportunité, négative → menace<br/>croissance > 10 % → opportunité, < 0 → menace<br/>concurrence faible → opportunité, élevée → menace

        S->>DB: bulk_create(éléments, genere_automatiquement = true)
        S-->>V: nombre d'éléments générés
        V->>DB: tous les éléments SWOT de l'étude
        DB-->>V: éléments manuels + générés
        V-->>F: 200 OK {generes, conserves, swot: [...]}
        F-->>E: Affiche la matrice SWOT
    end
```

## À retenir

- La génération est **rejouable** : chaque appel remplace uniquement les éléments générés automatiquement,
  sans doublon, et ne touche jamais aux éléments saisis à la main.
- Les règles sont simples et explicables (pas d'IA) : elles s'appuient sur les concurrents, tendances
  et personas que l'entrepreneur a associés à son étude.
