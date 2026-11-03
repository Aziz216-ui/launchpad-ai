# Image du secteur-service (LaunchPad AI, étude de marché).
# Contexte de build : Backend/Market (docker-compose.yml), pour installer market-commun.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

# Utilisateur sans privilèges pour exécuter le service
RUN groupadd --system app && useradd --system --gid app --home-dir /app app

WORKDIR /app

# Dépendances PyPI : versions exactes, paquets binaires uniquement (aucun script setup.py exécuté)
COPY secteur-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --only-binary :all: -r requirements.txt

# Bibliothèque partagée market-commun (code technique : Eureka, client REST, RabbitMQ, réglages)
COPY market-commun/pyproject.toml /tmp/market-commun/pyproject.toml
COPY market-commun/market_commun /tmp/market-commun/market_commun
RUN pip install --no-cache-dir --no-deps --no-build-isolation /tmp/market-commun && rm -rf /tmp/market-commun

# Code du service : uniquement les dossiers nécessaires
COPY secteur-service/manage.py ./
COPY secteur-service/config ./config
COPY secteur-service/clients ./clients
COPY secteur-service/secteurs ./secteurs

# Fichiers statiques (admin Django, Swagger) servis par WhiteNoise.
# DEBUG=True seulement pour cette commande : aucun secret n'est nécessaire à la construction.
RUN DEBUG=True python manage.py collectstatic --noinput
# Dossier de travail (non récursif) à l'utilisateur app : fichier de contrôle de gunicorn
RUN chown app:app /app

USER app

EXPOSE 8010

# Au démarrage : migrations puis lancement du serveur.
# --preload : Django est chargé une seule fois dans le processus maître, qui fait
# l'enregistrement Eureka (sinon chacun des 3 workers s'enregistrerait).
# exec : gunicorn remplace sh et reçoit le SIGTERM de "docker stop" (arrêt propre,
# désenregistrement Eureka).
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8010 --workers 3 --preload"]
