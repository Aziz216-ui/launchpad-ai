# workspace-service — Espaces comptables

Microservice de l'espace comptable LaunchPad. Documentation complète : [../README.md](../README.md).

| | |
|---|---|
| Entité | `AccountantWorkspace` (table `accountant_workspace`) |
| Port | **8091** (`APP_PORT`) |
| Base | `workspace_db` |
| Eureka | `ACCOUNTING-WORKSPACE-SERVICE` |
| Routes publiques | `/api/comptable/me`, `/api/comptable/workspaces/**` |
| Route interne | `GET /internal/workspaces/{id}` (lue par client-file-service) |
| Appelle | aucun service en HTTP |
| RabbitMQ | **publie** sur `client_file.workspace_status` à l'activation / désactivation d'un espace (consommé par client-file-service) |

L'espace d'un comptable est créé à sa première requête authentifiée (`WorkspaceProvisioningListener`).

```bash
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:fixtures:load --no-interaction
composer serve        # http://127.0.0.1:8091/api/comptable/docs
composer test         # inclut les tests unitaires du module commun
```
