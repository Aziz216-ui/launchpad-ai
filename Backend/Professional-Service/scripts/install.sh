#!/usr/bin/env bash
# Installe les 4 microservices : dépendances, base de données, migrations et données de démonstration.
# Usage (depuis Backend/Professional-Service) :  ./scripts/install.sh [--no-fixtures]
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
fixtures=true
[[ "${1:-}" == "--no-fixtures" ]] && fixtures=false

for service in workspace-service client-file-service document-service message-service; do
  echo -e "\n=== $service ==="
  (
    cd "$root/$service"
    composer install --no-interaction
    php bin/console doctrine:database:create --if-not-exists
    php bin/console doctrine:migrations:migrate --no-interaction
    if $fixtures; then php bin/console doctrine:fixtures:load --no-interaction; fi
    # Déclare les queues RabbitMQ des consommateurs (ignoré si RabbitMQ n'est pas encore démarré)
    php bin/console app:rabbitmq:consume --setup || true
  )
done

echo -e "\nInstallation terminée. Démarrage : ./scripts/start.sh"
