# client-file-service — Dossiers clients

Microservice de l'espace comptable LaunchPad. Documentation complète : [../README.md](../README.md).

| | |
|---|---|
| Entités | `ClientFile` (table `client_file`) et son historique `ClientFileAssignment` |
| Port | **8092** (`APP_PORT`) |
| Base | `client_file_db` |
| Eureka | `ACCOUNTING-CLIENT-FILE-SERVICE` |
| Routes publiques | `/api/comptable/files`, `/api/comptable/files/{id}` et ses actions (`accept`, `reject`, `assign`, `close`, `assignments`) |
| Route interne | `GET /internal/files/{id}` (contexte du dossier, pour document- et message-service) |
| Appelle | workspace-service : `GET /internal/workspaces/{id}` (demande de dossier, affectation) |
| RabbitMQ | **consomme** `client_file.workspace_status` (espace activé / désactivé), déclarée par ce service : `php bin/console app:rabbitmq:consume` |

`client_file` garde une copie de l'espace affecté (`workspace_id`, `accountant_id`, `accountant_display_name`,
`workspace_active`) : pas de clé étrangère vers `workspace_db`.

```bash
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:fixtures:load --no-interaction
composer serve        # http://127.0.0.1:8092/api/comptable/docs
composer test
```
