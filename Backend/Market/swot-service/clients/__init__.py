"""Clients REST vers les autres microservices du marché (résolus via Eureka)."""

from .base import RessourceIntrouvable, ServiceIndisponible  # noqa: F401
from .etude_client import EtudeClient  # noqa: F401
