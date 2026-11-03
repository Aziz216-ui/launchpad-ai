"""Point d'entrée WSGI du swot-service (gunicorn config.wsgi:application)."""

from market_commun.gestion import application_wsgi

application = application_wsgi()
