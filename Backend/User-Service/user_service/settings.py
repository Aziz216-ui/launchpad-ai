import os
from pathlib import Path
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-launchpad-keycloak-user-service-secret"
    else:
        raise ImproperlyConfigured(
            "SECRET_KEY environment variable must be set when DEBUG is not enabled."
        )

ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django_prometheus",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "drf_spectacular",
    # Local apps
    "authentication",
]

MIDDLEWARE = [
    "django_prometheus.middleware.PrometheusBeforeMiddleware",  # doit être le tout premier
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",  # doit être le tout dernier
]

ROOT_URLCONF = "user_service.urls"

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

WSGI_APPLICATION = "user_service.wsgi.application"

# PostgreSQL Database Configuration ; DB_ENGINE=sqlite pour lancer les tests sans serveur (CI).
if os.getenv("DB_ENGINE", "postgresql").lower() == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django_prometheus.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django_prometheus.db.backends.postgresql",
            "NAME": os.getenv("DB_NAME", "launchpad"),
            "USER": os.getenv("DB_USER", "app_user"),
            "PASSWORD": os.getenv("DB_PASSWORD", "12345678"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }

AUTH_USER_MODEL = "authentication.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "authentication.authentication.KeycloakAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Launchpad Auth & User Service API",
    "DESCRIPTION": "Interactive documentation for Keycloak & PostgreSQL user management (Register, Login, Token Refresh, Logout, Profile).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SECURITY": [{"BearerAuth": []}],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
}

# Keycloak Configuration
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080/")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "launchpad")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "launchpad-client")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")

# « Mot de passe oublié » : code à 6 chiffres envoyé par e-mail (POST /api/auth/forgot-password/),
# saisi avec le nouveau mot de passe (POST /api/auth/reset-password/).
PASSWORD_RESET_CODE_MINUTES = int(os.getenv("PASSWORD_RESET_CODE_MINUTES", "10"))     # validité du code
PASSWORD_RESET_MAX_ATTEMPTS = int(os.getenv("PASSWORD_RESET_MAX_ATTEMPTS", "5"))      # essais par code
PASSWORD_RESET_MAX_REQUESTS = int(os.getenv("PASSWORD_RESET_MAX_REQUESTS", "3"))      # demandes par e-mail...
PASSWORD_RESET_WINDOW_MINUTES = int(os.getenv("PASSWORD_RESET_WINDOW_MINUTES", "15"))  # ...et par 15 min
# Envoi de l'e-mail hors de la requête : même temps de réponse, que le compte existe ou non
PASSWORD_RESET_ASYNC = os.getenv("PASSWORD_RESET_ASYNC", "True").lower() in ("true", "1", "yes")

# E-mails (SMTP). Identifiants UNIQUEMENT par variables d'environnement (fichier .env racine, non
# suivi par Git). Sans EMAIL_HOST : Mailpit, serveur de test local (http://localhost:8025).
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST") or "mailpit"
EMAIL_PORT = int(os.getenv("EMAIL_PORT") or (1025 if EMAIL_HOST == "mailpit" else 587))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "False").lower() in ("true", "1", "yes")
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL") or "LaunchPad AI <no-reply@launchpad.local>"

# CORS is handled exclusively by the API Gateway; this service must not send
# its own CORS headers (duplicate headers cause browser errors).

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Eureka Discovery Configuration
EUREKA_SERVER_URL = os.getenv("EUREKA_SERVER_URL", "http://localhost:8761/eureka")
EUREKA_INSTANCE_HOST = os.getenv("EUREKA_INSTANCE_HOST", "localhost")
EUREKA_ENABLED = os.getenv("EUREKA_ENABLED", "True").lower() in ("true", "1", "yes")
SERVICE_PORT = int(os.getenv("PORT", "8001"))

