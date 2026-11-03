"""Point d'entrée ASGI du swot-service."""

from market_commun.gestion import application_asgi

application = application_asgi()
