"""Clients REST vers les autres microservices du marché (résolus via Eureka)."""

from market_commun.clients import RessourceIntrouvable, ServiceIndisponible  # noqa: F401
from .secteur_client import SecteurClient  # noqa: F401
