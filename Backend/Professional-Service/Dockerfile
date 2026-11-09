# Image UNIQUE des 4 microservices de l'espace comptable (Symfony 7.4, PHP 8.3).
# Contexte de build : Backend/Professional-Service. Le service lancé est choisi à l'exécution
# par la variable SERVICE (workspace-service, client-file-service, document-service, message-service).
FROM php:8.3-cli

# Extensions PHP : pdo_mysql, intl, zip, sockets (RabbitMQ), opcache
ADD https://github.com/mlocati/docker-php-extension-installer/releases/download/2.7.20/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions \
    && install-php-extensions pdo_mysql intl zip sockets opcache \
    && apt-get update && apt-get install -y --no-install-recommends git unzip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

# composer.json référence ../common/src : on garde la même arborescence qu'en local
WORKDIR /app
COPY common ./common
COPY workspace-service ./workspace-service
COPY client-file-service ./client-file-service
COPY document-service ./document-service
COPY message-service ./message-service
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN for s in workspace-service client-file-service document-service message-service; do \
      (cd /app/$s && composer install --no-interaction --no-progress --prefer-dist --no-scripts); \
    done

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# Le serveur PHP intégré lance plusieurs workers : indispensable car les services s'appellent entre eux en HTTP
ENV APP_HOST=0.0.0.0 PHP_CLI_SERVER_WORKERS=4 SERVICE=workspace-service
ENTRYPOINT ["docker-entrypoint.sh"]
# Par défaut : le serveur HTTP. Les consommateurs RabbitMQ surchargent la commande (voir docker-compose.yml).
CMD ["php", "bin/serve"]
