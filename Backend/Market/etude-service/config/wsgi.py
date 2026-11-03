"""Point d'entrée WSGI du etude-service (gunicorn config.wsgi:application)."""

from market_commun.gestion import application_wsgi

application = application_wsgi()
