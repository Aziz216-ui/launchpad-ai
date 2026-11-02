"""
Configuration Django du concurrent-service (LaunchPad AI, étude de marché).

Entités : Concurrent. Base PostgreSQL dédiée : concurrent_db.
Toutes les valeurs sensibles sont lues depuis le fichier .env
(voir .env.example).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Chargement des variables d'environnement depuis .env (s'il existe)
load_dotenv(BASE_DIR / ".env")


def env_bool(nom, defaut=False):
    """Convertit une variable d'environnement en booléen."""
    return os.getenv(nom, str(defaut)).strip().lower() in ("1", "true", "yes", "on")


def env_list(nom, defaut=""):
    """Convertit une variable d'environnement 'a,b,c' en liste."""
    return [v.strip() for v in os.getenv(nom, defaut).split(",") if v.strip()]


# --- Identité du service ------------------------------------------------------
SERVICE_NAME = "concurrent-service"
SERVICE_PORT = 8011

# --- Sécurité ---------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "changez-moi-en-production")
DEBUG = env_bool("DEBUG", False)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

# --- Applications -----------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Librairies tierces
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    # Application métier
    "concurrents",
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

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"

# --- Base de données ----------------------------------------------------------
# PostgreSQL par défaut (base dédiée au service). DB_ENGINE=sqlite permet de lancer
# rapidement les tests sans serveur PostgreSQL (option de secours).
if os.getenv("DB_ENGINE", "postgresql").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "concurrent_db"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }

# --- Validation des mots de passe ---------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --- Internationalisation -----------------------------------------------------
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Africa/Tunis"
USE_I18N = True
USE_TZ = True

# --- Fichiers statiques -------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS ---------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:4200")

# --- CSRF -----------------------------------------------------------------------
# Avec une session active (connexion à l'admin), DRF vérifie le CSRF sur les POST/PUT/
# PATCH/DELETE, dont l'en-tête Origin. Via l'API Gateway, l'Origin est
# http://localhost:8090 alors que Django reçoit Host: localhost:8011 : l'origine doit
# donc être déclarée ici (gateway, frontend Angular, accès direct).
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:8090,http://localhost:4200,http://localhost:8011"
)

# --- Eureka (découverte de services) -------------------------------------------
# EUREKA_ENABLED=true : enregistrement au démarrage du serveur (concurrents/eureka.py)
# ET résolution des autres services par leur nom Eureka (clients/base.py).
EUREKA_ENABLED = env_bool("EUREKA_ENABLED", False)
EUREKA_SERVER_URL = os.getenv("EUREKA_SERVER_URL", "http://localhost:8761/eureka/")
EUREKA_INSTANCE_HOST = os.getenv("EUREKA_INSTANCE_HOST", "localhost")
EUREKA_APP_NAME = "CONCURRENT-SERVICE"
EUREKA_INSTANCE_PORT = SERVICE_PORT
EUREKA_HEALTH_PATH = "/api/market/concurrents/health/"
EUREKA_DOCS_PATH = "/api/market/concurrents/docs/"
# En Docker, les services s'annoncent sur localhost:<port> (pour la gateway lancée sur
# la machine hôte). Dans un conteneur, "localhost" désigne le conteneur lui-même :
# l'adresse lue dans Eureka est alors réécrite avec cet alias (host.docker.internal).
EUREKA_LOCALHOST_ALIAS = os.getenv("EUREKA_LOCALHOST_ALIAS", "")

# --- Services appelés (clients/) ------------------------------------------------
# URL directe utilisée si Eureka est désactivé ou ne connaît aucune instance UP.
SERVICES_URLS = {
    "SECTEUR-SERVICE": os.getenv("SECTEUR_SERVICE_URL", "http://localhost:8010"),
}
SERVICE_CLIENT_TIMEOUT = float(os.getenv("SERVICE_CLIENT_TIMEOUT", "3"))  # secondes
SERVICE_CLIENT_RETRIES = 1  # une nouvelle tentative en cas d'erreur réseau

# --- Logs -----------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "loggers": {
        "concurrents": {"handlers": ["console"], "level": "INFO"},
        "clients": {"handlers": ["console"], "level": "INFO"},
    },
}

# --- Django REST Framework ----------------------------------------------------
REST_FRAMEWORK = {
    # Les décimaux sont renvoyés en nombres JSON (18.75) et non en chaînes ("18.75")
    "COERCE_DECIMAL_TO_STRING": False,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    # Service appelé injoignable -> 503 {"service": "<NOM>", "message": "Service indisponible"}
    "EXCEPTION_HANDLER": "concurrents.exceptions.gestionnaire_exceptions",
}

# --- Documentation Swagger (drf-spectacular) ----------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "LaunchPad AI - Concurrent Service",
    "DESCRIPTION": (
        "Concurrents des secteurs (prix, parts de marché, forces/faiblesses). À la création "
        "et à la modification, le secteur est vérifié auprès de SECTEUR-SERVICE (Eureka)."
    ),
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
