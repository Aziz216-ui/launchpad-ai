# Image du Market-Service (LaunchPad AI)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Installation des dépendances (couche mise en cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code source
COPY . .

# Fichiers statiques (admin Django) servis par WhiteNoise
RUN python manage.py collectstatic --noinput

EXPOSE 8005

# Au démarrage : migrations puis lancement du serveur
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8005 --workers 3"]
