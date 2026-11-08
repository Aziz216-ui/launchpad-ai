"""Point d'entrée WSGI du concurrent-service (gunicorn config.wsgi:application)."""

from market_commun.gestion import application_wsgi

application = application_wsgi()
