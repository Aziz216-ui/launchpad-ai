# message-service — Messages

Microservice de l'espace comptable LaunchPad. Documentation complète : [../README.md](../README.md).

| | |
|---|---|
| Entité | `Message` (table `message`) |
| Port | **8094** (`APP_PORT`) |
| Base | `message_db` |
| Eureka | `ACCOUNTING-MESSAGE-SERVICE` |
| Routes publiques | `/api/comptable/files/{id}/messages`, `/api/comptable/messages/{id}/read` |
| Routes internes | aucune |
| Appelle | client-file-service : `GET /internal/files/{id}` ; document-service : `GET /internal/documents/{id}` (document cité) |
| RabbitMQ | **consomme** `message.document_decided` (notification automatique dans le fil), déclarée par ce service : `php bin/console app:rabbitmq:consume` |

Un message référence son dossier (`client_file_id`) et, facultativement, un document (`document_id`) par leur UUID.

```bash
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:fixtures:load --no-interaction
composer serve        # http://127.0.0.1:8094/api/comptable/docs
composer test
```
