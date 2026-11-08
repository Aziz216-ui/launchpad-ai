# document-service — Documents comptables

Microservice de l'espace comptable LaunchPad. Documentation complète : [../README.md](../README.md).

| | |
|---|---|
| Entités | `AccountingDocument` (table `accounting_document`) et ses historiques `Validation`, `DocumentEvent` |
| Port | **8093** (`APP_PORT`) |
| Base | `document_db` ; fichiers dans `DOCUMENT_STORAGE_DIR` (privé, `var/uploads` par défaut) |
| Eureka | `ACCOUNTING-DOCUMENT-SERVICE` |
| Routes publiques | `/api/comptable/files/{id}/documents/**`, `/api/comptable/documents/**` |
| Route interne | `GET /internal/documents/{id}` (lue par message-service) |
| Appelle | client-file-service : `GET /internal/files/{id}` (droits et statut du dossier) |
| RabbitMQ | **publie** sur `message.document_decided` à chaque validation / rejet par le comptable |

Un document référence son dossier par `client_file_id` (UUID, sans clé étrangère vers `client_file_db`).

```bash
composer install
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console doctrine:fixtures:load --no-interaction
composer serve        # http://127.0.0.1:8093/api/comptable/docs
composer test
```
