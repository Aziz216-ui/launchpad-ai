# Image du secteur-service (LaunchPad AI, étude de marché).
# Contexte de build : Backend/Market (docker-compose.yml), pour installer market-commun.

# --- Étape 1 : construction de la wheel de la bibliothèque partagée market-commun -------
FROM python:3.12-slim AS builder
COPY market-commun/pyproject.toml /src/market-commun/pyproject.toml
COPY market-commun/market_commun /src/market-commun/market_commun
RUN pip wheel --no-cache-dir --no-deps /src/market-commun -w /wheels

# --- Étape 2 : image du service ----------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Utilisateur sans privilèges pour exécuter le service
RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app app

WORKDIR /app

# Dépendances PyPI verrouillées (hashes), paquets binaires uniquement : aucun script exécuté
COPY secteur-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --require-hashes --only-binary :all: -r requirements.txt

# market-commun : wheel construite à l'étape 1, installée hors ligne et sans ses dépendances
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir --no-index --no-deps --only-binary :all: --find-links /wheels market-commun \
    && rm -rf /wheels

# Code du service : uniquement les dossiers nécessaires
COPY secteur-service/manage.py ./
COPY secteur-service/config ./config
COPY secteur-service/clients ./clients
COPY secteur-service/secteurs ./secteurs

# Fichiers statiques (admin Django, Swagger) servis par WhiteNoise : DEBUG=True seulement pour
# cette commande (aucun secret nécessaire). Puis dossier de travail (non récursif) à l'utilisateur
# app, pour le fichier de contrôle de gunicorn.
RUN DEBUG=True python manage.py collectstatic --noinput \
    && chown app:app /app

USER app

EXPOSE 8010

# Au démarrage : migrations puis lancement du serveur.
# --preload : Django est chargé une seule fois dans le processus maître, qui fait
# l'enregistrement Eureka (sinon chacun des 3 workers s'enregistrerait).
# exec : gunicorn remplace sh et reçoit le SIGTERM de "docker stop" (arrêt propre,
# désenregistrement Eureka).
CMD ["sh", "-c", "python manage.py migrate --noinput \
    && exec gunicorn config.wsgi:application --bind 0.0.0.0:8010 --workers 3 --preload"]
