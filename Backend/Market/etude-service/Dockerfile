# Image du etude-service (LaunchPad AI, étude de marché).
# Contexte de build : Backend/Market (docker-compose.yml), pour copier market-commun.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Utilisateur sans privilèges pour exécuter le service
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app app

WORKDIR /app

# Dépendances PyPI verrouillées (hashes), paquets binaires uniquement : aucun script exécuté
COPY etude-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --require-hashes --only-binary :all: -r requirements.txt

# Bibliothèque partagée market-commun : package source copié dans /app (PYTHONPATH),
# ses dépendances sont déjà installées par requirements.txt (hashes)
COPY market-commun/market_commun ./market_commun

# Code du service : uniquement les dossiers nécessaires
COPY etude-service/manage.py ./
COPY etude-service/config ./config
COPY etude-service/clients ./clients
COPY etude-service/etudes ./etudes

# Fichiers statiques (admin Django, Swagger) servis par WhiteNoise : DEBUG=True seulement pour
# cette commande (aucun secret nécessaire). Puis dossier de travail (non récursif) à l'utilisateur
# app, pour le fichier de contrôle de gunicorn.
RUN DEBUG=True python manage.py collectstatic --noinput \
    && chown app:app /app

USER app

EXPOSE 8012

# Au démarrage : migrations puis lancement du serveur.
# --preload : Django est chargé une seule fois dans le processus maître, qui fait
# l'enregistrement Eureka (sinon chacun des 3 workers s'enregistrerait).
# exec : gunicorn remplace sh et reçoit le SIGTERM de "docker stop" (arrêt propre,
# désenregistrement Eureka).
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:8012 --workers 3 --preload"]
