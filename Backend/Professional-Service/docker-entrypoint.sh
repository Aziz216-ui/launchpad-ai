#!/bin/sh
# Démarrage d'un microservice comptable en conteneur :
#   1. attend la base MySQL, 2. applique les migrations, 3. charge les données de démo (une fois),
#   4. déclare les queues RabbitMQ, 5. lance la commande demandée (serveur HTTP ou consommateur).
set -e
cd "/app/${SERVICE}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[${SERVICE}] attente de la base de données..."
  i=0
  until php bin/console doctrine:database:create --if-not-exists >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -ge 60 ] && echo "base injoignable" && exit 1
    sleep 2
  done
  php bin/console doctrine:migrations:migrate --no-interaction
  if [ "${LOAD_FIXTURES:-true}" = "true" ] && [ ! -f var/.fixtures-loaded ]; then
    php bin/console doctrine:fixtures:load --no-interaction && mkdir -p var && touch var/.fixtures-loaded
  fi
  # Déclare les queues RabbitMQ du service (ignoré si le broker n'est pas encore prêt)
  php bin/console app:rabbitmq:consume --setup || true
fi

exec "$@"
