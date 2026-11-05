"""
Réglages Django communs aux services du marché.

Usage dans config/settings.py d'un service :

    globals().update(reglages_service(base_dir=BASE_DIR, nom="secteur-service", port=8010, ...))

Secrets (SECRET_KEY, DB_PASSWORD, RABBITMQ_PASSWORD) : lus UNIQUEMENT dans les variables
d'environnement (fichier .env, voir .env.example). Absents avec DEBUG=False : le service
refuse de démarrer (ImproperlyConfigured). Avec DEBUG=True : clé aléatoire / mot de passe vide.
"""

import logging
import os
import secrets
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

LOCAL = "http://localhost:{}"  # origines et URL de développement (machine locale)


def env_bool(nom, defaut=False):
    """Convertit une variable d'environnement en booléen."""
    return os.getenv(nom, str(defaut)).strip().lower() in ("1", "true", "yes", "on")


def env_list(nom, defaut=""):
    """Convertit une variable d'environnement 'a,b,c' en liste."""
    return [v.strip() for v in os.getenv(nom, defaut).split(",") if v.strip()]


def variable_secrete(nom, debug):
    """Secret lu dans l'environnement ; obligatoire en production (DEBUG=False)."""
    valeur = os.getenv(nom)
    if valeur:
        return valeur
    if not debug:
        raise ImproperlyConfigured(
            f"La variable d'environnement {nom} est obligatoire quand DEBUG=False (voir .env.example).")
    return ""


def cle_secrete(debug):
    """SECRET_KEY ; en DEBUG sans variable, une clé aléatoire (valable le temps du processus)."""
    return variable_secrete("SECRET_KEY", debug) or secrets.token_urlsafe(50)


def base_de_donnees(base_dir, nom_base, debug):
    """PostgreSQL (base dédiée au service) ; DB_ENGINE=sqlite pour lancer les tests sans serveur."""
    if os.getenv("DB_ENGINE", "postgresql").lower() == "sqlite":
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": Path(base_dir) / "db.sqlite3"}
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", nom_base),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": variable_secrete("DB_PASSWORD", debug),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }


def _applications(app):
    return [
        "django.contrib.admin",
        "django.contrib.auth",
        "django.contrib.contenttypes",
        "django.contrib.sessions",
        "django.contrib.messages",
        "django.contrib.staticfiles",
        "rest_framework",
        "corsheaders",
        "drf_spectacular",
        "market_commun",             # enregistrement Eureka
        "market_commun.evenements",  # RabbitMQ : outbox, messages traités, consume_events
        app,                         # application métier du service
    ]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # fichiers statiques (admin) en Docker
    "corsheaders.middleware.CorsMiddleware",  # doit être avant CommonMiddleware
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": f"django.contrib.auth.password_validation.{nom}"}
    for nom in ("UserAttributeSimilarityValidator", "MinimumLengthValidator",
                "CommonPasswordValidator", "NumericPasswordValidator")
]


def _logs(app):
    console = {"handlers": ["console"], "level": "INFO"}
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {"console": {"class": "logging.StreamHandler"}},
        "loggers": {app: console, "clients": console, "market_commun": console},
    }


def _rest_framework():
    return {
        # Les décimaux sont renvoyés en nombres JSON (18.75) et non en chaînes ("18.75")
        "COERCE_DECIMAL_TO_STRING": False,
        "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
        "DEFAULT_FILTER_BACKENDS": [
            "rest_framework.filters.SearchFilter",
            "rest_framework.filters.OrderingFilter",
        ],
        # Service appelé injoignable -> 503 {"service": "<NOM>", "message": "Service indisponible"}
        "EXCEPTION_HANDLER": "market_commun.exceptions.gestionnaire_exceptions",
    }


def _eureka(eureka_app, port, ressource):
    # EUREKA_ENABLED=true : enregistrement au démarrage du serveur (eureka.py)
    # ET résolution des autres services par leur nom Eureka (clients.py).
    return {
        "EUREKA_ENABLED": env_bool("EUREKA_ENABLED", False),
        "EUREKA_SERVER_URL": os.getenv("EUREKA_SERVER_URL", LOCAL.format(8761) + "/eureka/"),
        "EUREKA_INSTANCE_HOST": os.getenv("EUREKA_INSTANCE_HOST", "localhost"),
        "EUREKA_APP_NAME": eureka_app,
        "EUREKA_INSTANCE_PORT": port,
        "EUREKA_HEALTH_PATH": f"/api/market/{ressource}/health/",
        "EUREKA_DOCS_PATH": f"/api/market/{ressource}/docs/",
        # En Docker, les services s'annoncent sur localhost:<port> (pour la gateway lancée sur
        # la machine hôte) ; dans un conteneur, "localhost" est réécrit avec cet alias.
        "EUREKA_LOCALHOST_ALIAS": os.getenv("EUREKA_LOCALHOST_ALIAS", ""),
    }


def _rabbitmq(debug, publies, consommes):
    # Les producers publient sur l'exchange topic "market.events" ; les consumers tournent
    # dans un conteneur séparé (python manage.py consume_events).
    return {
        "RABBITMQ_HOST": os.getenv("RABBITMQ_HOST", "localhost"),
        "RABBITMQ_PORT": int(os.getenv("RABBITMQ_PORT", "5672")),
        "RABBITMQ_USER": os.getenv("RABBITMQ_USER", "market"),
        "RABBITMQ_PASSWORD": variable_secrete("RABBITMQ_PASSWORD", debug),
        "EVENEMENTS_PUBLIES": list(publies),       # routing keys : active le relais de l'outbox
        "EVENEMENTS_CONSOMMES": dict(consommes),   # queue -> (routing key, handler)
    }


def reglages_service(*, base_dir, nom, port, app, ressource, eureka_app, nom_base, titre, description,
                     services_appeles=None, evenements_publies=(), evenements_consommes=None):
    """
    Réglages complets d'un service.

    services_appeles : {"SECTEUR-SERVICE": ("SECTEUR_SERVICE_URL", 8010)} : URL directe utilisée
    si Eureka est désactivé ou ne connaît aucune instance UP.
    """
    load_dotenv(Path(base_dir) / ".env")
    debug = env_bool("DEBUG", False)
    reglages = {
        "SERVICE_NAME": nom,
        "SERVICE_PORT": port,
        "SECRET_KEY": cle_secrete(debug),
        "DEBUG": debug,
        "ALLOWED_HOSTS": env_list("ALLOWED_HOSTS", "localhost,127.0.0.1"),
        "INSTALLED_APPS": _applications(app),
        "MIDDLEWARE": MIDDLEWARE,
        "ROOT_URLCONF": "config.urls",
        "TEMPLATES": TEMPLATES,
        "WSGI_APPLICATION": "config.wsgi.application",
        "DATABASES": {"default": base_de_donnees(base_dir, nom_base, debug)},
        "AUTH_PASSWORD_VALIDATORS": AUTH_PASSWORD_VALIDATORS,
        "LANGUAGE_CODE": "fr-fr",
        "TIME_ZONE": "Africa/Tunis",
        "USE_I18N": True,
        "USE_TZ": True,
        "STATIC_URL": "static/",
        "STATIC_ROOT": Path(base_dir) / "staticfiles",
        "DEFAULT_AUTO_FIELD": "django.db.models.BigAutoField",
        # CORS : frontend Angular (CORS_ALLOW_ALL_ORIGINS=True autorise tout, à éviter)
        "CORS_ALLOW_ALL_ORIGINS": env_bool("CORS_ALLOW_ALL_ORIGINS", False),
        "CORS_ALLOWED_ORIGINS": env_list("CORS_ALLOWED_ORIGINS", LOCAL.format(4200)),
        # CSRF : avec une session admin, DRF vérifie l'Origin des POST/PUT/PATCH/DELETE. Via la
        # gateway, l'Origin est localhost:8090 alors que Django reçoit Host: localhost:<port>.
        "CSRF_TRUSTED_ORIGINS": env_list(
            "CSRF_TRUSTED_ORIGINS", ",".join(LOCAL.format(p) for p in (8090, 4200, port))),
        # Schéma des appels entre services (http sur le réseau Docker interne et pour Eureka)
        "SERVICE_SCHEME": os.getenv("SERVICE_SCHEME", "http"),
        "SERVICES_URLS": {
            service: os.getenv(variable, LOCAL.format(port_service))
            for service, (variable, port_service) in (services_appeles or {}).items()
        },
        "SERVICE_CLIENT_TIMEOUT": float(os.getenv("SERVICE_CLIENT_TIMEOUT", "3")),  # secondes
        "SERVICE_CLIENT_RETRIES": 1,  # une nouvelle tentative en cas d'erreur réseau
        "LOGGING": _logs(app),
        "REST_FRAMEWORK": _rest_framework(),
        "SPECTACULAR_SETTINGS": {
            "TITLE": titre,
            "DESCRIPTION": description,
            "VERSION": "2.0.0",
            "SERVE_INCLUDE_SCHEMA": False,
        },
    }
    reglages.update(_eureka(eureka_app, port, ressource))
    reglages.update(_rabbitmq(debug, evenements_publies, evenements_consommes or {}))
    return reglages
