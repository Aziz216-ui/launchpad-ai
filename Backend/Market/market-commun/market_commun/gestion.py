"""Points d'entrée Django communs : manage.py, wsgi.py (gunicorn) et asgi.py de chaque service."""

import os
import sys

REGLAGES = "config.settings"


def executer(argv=None):
    """Équivalent du manage.py généré par Django."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", REGLAGES)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django est introuvable : activer l'environnement virtuel et installer requirements.txt."
        ) from exc
    execute_from_command_line(argv or sys.argv)


def application_wsgi():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", REGLAGES)
    from django.core.wsgi import get_wsgi_application

    return get_wsgi_application()


def application_asgi():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", REGLAGES)
    from django.core.asgi import get_asgi_application

    return get_asgi_application()
