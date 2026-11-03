"""Point d'entrée ASGI du concurrent-service."""

from market_commun.gestion import application_asgi

application = application_asgi()
