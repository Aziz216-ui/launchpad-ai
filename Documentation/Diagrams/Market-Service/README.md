# Diagrammes UML — Market-Service

Diagrammes de conception du Market-Service (LaunchPad AI), réalisés à partir du code de
`Backend/Market-Service/marche/` (`models.py`, `views.py`, `services/`, `urls.py`).
Chaque diagramme existe en source Mermaid (`.md`, affiché directement par GitHub/GitLab et VS Code)
et en image PNG pour le rapport et la soutenance.

| Diagramme | Source | Image |
|---|---|---|
| Diagramme de classes | [diagramme-classes.md](diagramme-classes.md) | [PNG](diagramme-classes.png) |
| Séquence : analyse d'un projet | [diagramme-sequence-analyse-projet.md](diagramme-sequence-analyse-projet.md) | [PNG](diagramme-sequence-analyse-projet.png) |
| Séquence : création d'un concurrent | [diagramme-sequence-crud-concurrent.md](diagramme-sequence-crud-concurrent.md) | [PNG](diagramme-sequence-crud-concurrent.png) |
| Séquence : génération de la SWOT | [diagramme-sequence-generer-swot.md](diagramme-sequence-generer-swot.md) | [PNG](diagramme-sequence-generer-swot.png) |
| Cas d'utilisation | [diagramme-cas-utilisation.md](diagramme-cas-utilisation.md) · [PlantUML](diagramme-cas-utilisation.puml) | [PNG Mermaid](diagramme-cas-utilisation.png) · [PNG PlantUML](diagramme-cas-utilisation-plantuml.png) |
| Architecture | [architecture-market-service.md](architecture-market-service.md) | [PNG](architecture-market-service.png) |

## 1. Diagramme de classes
Il présente les six modèles persistés dans PostgreSQL : `Secteur`, `Concurrent`, `Tendance`,
`EtudeMarche` et ses deux compositions `Persona` et `ElementSWOT`, avec leurs attributs et types Django.
L'étude de marché est reliée à ses concurrents et tendances par des associations ManyToMany, tandis que
`projet_id` et `entrepreneur_id` ne sont que des références vers d'autres microservices (pas de clé étrangère).

## 2. Séquence : analyse du marché d'un projet
Ce diagramme montre comment le AI-Service obtient le résumé de marché d'un projet via
`GET /api/market/analyse/projet/<id>/` : la vue délègue à `services/analyse.py`, qui interroge la base puis calcule
le niveau de concurrence de chaque secteur. Le bloc `alt` montre qu'un projet sans étude renvoie quand même
`200` avec des listes vides et le niveau `"inconnu"`.

## 3. Séquence : création d'un concurrent
Il décrit l'appel `POST /api/market/concurrents/` envoyé par le Frontend et le rôle du `ConcurrentSerializer`
dans la validation des données. Si les règles du modèle sont respectées (`prix_moyen ≥ 0`,
`0 ≤ part_de_marche ≤ 100`, secteur existant), l'API répond `201` ; sinon elle répond `400` avec un
message d'erreur par champ, sans rien écrire en base.

## 4. Séquence : génération de la SWOT
Ce diagramme détaille `POST /api/market/etudes/<id>/generer-swot/` : dans une transaction, le service supprime
uniquement les éléments SWOT générés automatiquement, recalcule forces et faiblesses (prix, personas, offre)
puis opportunités et menaces (tendances, croissance, concurrence). Les éléments saisis à la main par
l'entrepreneur sont toujours conservés, ce qui rend la génération rejouable sans doublon.

## 5. Diagramme de cas d'utilisation
Il identifie les trois acteurs du service : l'Entrepreneur (utilisateur principal du cahier des charges),
l'Administrateur et le AI-Service (acteur système). Il regroupe les cas de l'étude de marché (marché cible,
concurrents, prix, personas, opportunités/menaces, SWOT, rapport, finalisation) et ceux des données de
référence. Une version PlantUML (`.puml`) respecte la notation UML standard, avec `<<include>>` et `<<extend>>`.

## 6. Architecture
Cette vue situe le Market-Service (Django REST, port 8005) dans l'architecture microservices du projet,
entre ses clients (Frontend, AI-Service), la future API Gateway et sa propre base PostgreSQL ; la logique
métier (analyses, étude de marché, SWOT, rapport PDF) est regroupée dans le package `services/`. Les autres
services du groupe apparaissent en gris pour le contexte : ils ne partagent pas la base du Market-Service.

## Régénérer les images
Les images font 1600 px sur leur plus grande dimension, fond blanc. Depuis ce dossier, après avoir copié
le bloc Mermaid d'un fichier dans un fichier `.mmd` temporaire :

```bash
npx -y @mermaid-js/mermaid-cli -i diagramme-classes.mmd -o diagramme-classes.png -b white --size 1600
```

> Avec mermaid-cli 12, l'option `-w` n'existe plus : elle est remplacée par `--size`.
> Si Chromium refuse de démarrer (`ConnectionClosedError`), ajouter `-p puppeteer.json` avec un fichier
> contenant `{"args": ["--no-sandbox"]}`.

Pour le diagramme PlantUML (Java requis, Graphviz facultatif grâce au moteur `smetana`) :

```bash
java -jar plantuml.jar -charset UTF-8 -Playout=smetana -Sdpi=150 -tpng -o sortie diagramme-cas-utilisation.puml
# puis renommer sortie/diagramme-cas-utilisation.png en diagramme-cas-utilisation-plantuml.png
```

Sans outil local : coller le bloc Mermaid sur <https://mermaid.live> (*Actions → PNG*), ou le fichier
`.puml` sur <https://www.plantuml.com/plantuml>.
