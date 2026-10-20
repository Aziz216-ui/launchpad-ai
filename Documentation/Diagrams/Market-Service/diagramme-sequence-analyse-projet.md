# Diagramme de séquence — Analyse du marché d'un projet

Appel du AI-Service vers `GET /api/market/analyse/projet/<projet_id>/`
(`AnalyseProjetView` → `services.analyser_projet`, dans `marche/services/analyse.py`).

![Séquence analyse projet](diagramme-sequence-analyse-projet.png)

```mermaid
sequenceDiagram
    autonumber
    participant AI as AI-Service
    participant V as AnalyseProjetView<br/>(views.py)
    participant S as services/analyse.py
    participant DB as PostgreSQL<br/>(market_db)

    AI->>V: GET /api/market/analyse/projet/{projet_id}/
    V->>S: analyser_projet(projet_id)
    S->>DB: EtudeMarche.objects.filter(projet_id).select_related("secteur")
    DB-->>S: études du projet
    S->>DB: Secteur.objects.filter(id__in = secteurs des études)
    DB-->>S: secteurs concernés
    Note over S: niveau_global = "inconnu"

    alt Projet avec au moins une étude
        loop Pour chaque secteur du projet
            S->>DB: Concurrent.objects.filter(secteur)
            DB-->>S: concurrents (nb, Sum part_de_marche)
            S->>DB: Tendance.objects.filter(secteur)
            DB-->>S: tendances
            S->>S: calculer_niveau_concurrence(nb, part_cumulee)
            Note right of S: eleve : nb ≥ 6 ou part ≥ 60 %<br/>moyen : nb ≥ 3 ou part ≥ 30 %<br/>sinon faible
            S->>S: niveau_global = niveau le plus élevé
        end
        S-->>V: dict {projet_id, nombre_etudes, etudes,<br/>secteurs, concurrents, tendances, niveau_concurrence}
        V-->>AI: 200 OK (JSON complet)
    else Projet sans étude
        Note over S: aucun secteur : la boucle ne s'exécute pas
        S-->>V: dict {nombre_etudes: 0, etudes: [], secteurs: [],<br/>concurrents: [], tendances: [], niveau_concurrence: "inconnu"}
        V-->>AI: 200 OK (listes vides, "inconnu")
    end
```

## À retenir

- Un projet sans étude **n'est pas une erreur** : la réponse est toujours `200`, ce qui simplifie
  le traitement côté AI-Service (pas de `404` à gérer).
- Le niveau de concurrence global du projet est le **maximum** des niveaux de ses secteurs,
  selon l'ordre `inconnu < faible < moyen < eleve`.
