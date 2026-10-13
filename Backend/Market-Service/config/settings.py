"""
Configuration Django du Market-Service (LaunchPad AI).

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
    "marche",
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
# PostgreSQL par défaut. DB_ENGINE=sqlite permet de lancer rapidement
# les tests sans serveur PostgreSQL (option de secours).
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
            "NAME": os.getenv("DB_NAME", "market_db"),
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
# En développement on autorise tout ; sinon on liste les origines autorisées.
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", DEBUG)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000")

# --- Django REST Framework ----------------------------------------------------
REST_FRAMEWORK = {
    # Les décimaux sont renvoyés en nombres JSON (18.75) et non en chaînes ("18.75")
    "COERCE_DECIMAL_TO_STRING": False,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}

# --- Documentation Swagger (drf-spectacular) ----------------------------------
SPECTACULAR_SETTINGS = {
    "TITLE": "LaunchPad AI - Market Service",
    "DESCRIPTION": "Analyse du marché et des concurrents des projets LaunchPad AI.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}
