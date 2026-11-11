# Diagrammes UML — Finance (Prevision-Service et Document-Service)

Diagrammes de conception du module Finance, établis à partir du code de `Backend/Finance-Service/`.
Chaque diagramme existe en source **Mermaid** (`.md`, affichée directement par GitHub, GitLab et VS Code) et en
**image PNG** pour le rapport et la soutenance (générée avec `@mermaid-js/mermaid-cli`).

| Diagramme | Source | Image |
|---|---|---|
| Cas d'utilisation (entrepreneur, financier) | [cas-utilisation.md](cas-utilisation.md) | [PNG](cas-utilisation.png) |
| Architecture et communication | [architecture.md](architecture.md) | [PNG](architecture.png) |
| Classes — Prevision-Service | [classes-prevision-service.md](classes-prevision-service.md) | [PNG](classes-prevision-service.png) |
| Classes — Document-Service | [classes-document-service.md](classes-document-service.md) | [PNG](classes-document-service.png) |
| Séquence : génération puis certification d'un document (Feign) | [sequence-certification-feign.md](sequence-certification-feign.md) | [PNG](sequence-certification-feign.png) |
| Séquence : avis du financier et notifications (RabbitMQ) | [sequence-avis-rabbitmq.md](sequence-avis-rabbitmq.md) | [PNG](sequence-avis-rabbitmq.png) |
| États d'une prévision | [etats-prevision.md](etats-prevision.md) | [PNG](etats-prevision.png) |

Régénérer les images : `npx @mermaid-js/mermaid-cli -i <fichier>.md -o sortie.md -e png -s 2 -b white`.

## Lecture rapide

- **Cas d'utilisation** : ce que fait chacun des deux rôles sur un projet (l'entrepreneur produit, le financier relit
  et valide), et les actions communes.
- **Architecture** : les deux microservices, leurs bases, la gateway, Eureka, Keycloak, RabbitMQ et le LLM ; les flèches
  distinguent les appels **synchrones (OpenFeign)** et les messages **asynchrones (RabbitMQ)**.
- **Classes** : le modèle métier en Java pur (records) de chaque service, avec ses ports (interfaces) et adaptateurs.
- **Certification (Feign)** : trois appels synchrones du Document-Service vers le Prevision-Service (droits, synthèse,
  état de la prévision) et la règle de l'empreinte des chiffres.
- **Avis (RabbitMQ)** : publication après commit sur `finance.events`, consommation par le Document-Service et
  dédoublonnage, notifications filtrées par rôle.
- **États** : cycle de vie d'une prévision (en attente → validée / rejetée → en attente si les chiffres changent).
