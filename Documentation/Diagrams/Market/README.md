# Diagrammes — Étude de marché en microservices

Diagrammes des 4 microservices de `Backend/Market/` (découpage de l'ancien Market-Service,
dont les diagrammes restent dans [../Market-Service/](../Market-Service/)).
Chaque diagramme existe en source Mermaid (`.md`, affiché par GitHub et VS Code) et en PNG.

| Diagramme | Source | Image |
|---|---|---|
| Architecture des 4 services | [architecture-microservices.md](architecture-microservices.md) | [PNG](architecture-microservices.png) |
| Classes — secteur-service | [diagramme-classes-secteur-service.md](diagramme-classes-secteur-service.md) | [PNG](diagramme-classes-secteur-service.png) |
| Classes — concurrent-service | [diagramme-classes-concurrent-service.md](diagramme-classes-concurrent-service.md) | [PNG](diagramme-classes-concurrent-service.png) |
| Classes — etude-service | [diagramme-classes-etude-service.md](diagramme-classes-etude-service.md) | [PNG](diagramme-classes-etude-service.png) |
| Classes — swot-service | [diagramme-classes-swot-service.md](diagramme-classes-swot-service.md) | [PNG](diagramme-classes-swot-service.png) |
| Séquence : création d'un concurrent avec vérification du secteur via Eureka | [diagramme-sequence-creation-concurrent.md](diagramme-sequence-creation-concurrent.md) | [PNG](diagramme-sequence-creation-concurrent.png) |

## Régénérer les images

Copier le bloc Mermaid d'un fichier dans un `.mmd` temporaire, puis :

```bash
npx -y @mermaid-js/mermaid-cli -i architecture-microservices.mmd -o architecture-microservices.png -b white --size 1600
```

Si Chromium refuse de démarrer, ajouter `-p puppeteer.json` avec `{"args": ["--no-sandbox"]}`.
Sans outil local : coller le bloc sur <https://mermaid.live> (*Actions → PNG*).
