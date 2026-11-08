#!/usr/bin/env bash
# Démarre les 2 consommateurs RabbitMQ puis les 4 microservices en arrière-plan
# (journaux dans <service>/var/log/) ; Ctrl+C les arrête tous.
# Prérequis : MySQL/MariaDB et RabbitMQ démarrés.
# Usage (depuis Backend/Professional-Service) :  ./scripts/start.sh
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
pids=()

# 1. Consommateurs RabbitMQ en premier : ils déclarent leurs queues
for service in client-file-service message-service; do
  mkdir -p "$root/$service/var/log"
  (cd "$root/$service" && exec php bin/console app:rabbitmq:consume) > "$root/$service/var/log/consumer.log" 2>&1 &
  pids+=($!)
  echo "$service : consommateur RabbitMQ (journal : $service/var/log/consumer.log)"
done
sleep 3

# 2. Les API HTTP
for service in workspace-service client-file-service document-service message-service; do
  mkdir -p "$root/$service/var/log"
  (cd "$root/$service" && exec composer serve) > "$root/$service/var/log/serve.log" 2>&1 &
  pids+=($!)
  echo "$service démarré (journal : $service/var/log/serve.log)"
done

echo "Interface RabbitMQ : http://localhost:15672 (guest / guest)"
trap 'kill "${pids[@]}" 2>/dev/null' INT TERM
wait
