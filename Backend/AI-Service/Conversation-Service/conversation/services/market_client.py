"""
Client HTTP pour le service d'Étude de marché (ETUDE-SERVICE) depuis Conversation-Service.
"""
from __future__ import annotations

import logging
import os

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = 5  # secondes
_DEFAULT_FALLBACK = "http://localhost:8090"


def _resoudre_base_url() -> str:
    """Résout l'URL de base d'ETUDE-SERVICE via Eureka ou repli sur Gateway."""
    service_name = getattr(settings, "MARKET_SERVICE_NAME", os.getenv("MARKET_SERVICE_NAME", "ETUDE-SERVICE"))
    try:
        import py_eureka_client.eureka_client as eureka_client
        url = eureka_client.do_service(
            service_name.upper(),
            lambda base_url: base_url,
        )
        if url:
            logger.debug("ETUDE-SERVICE résolu via Eureka : %s", url)
            return url.rstrip("/")
    except Exception as exc:
        logger.debug("Eureka: impossible de résoudre '%s' : %s — repli sur env.", service_name, exc)

    fallback = getattr(settings, "MARKET_SERVICE_URL", _DEFAULT_FALLBACK)
    return fallback.rstrip("/")


def recuperer_donnees_marche(projet_id: int) -> dict:
    """
    Appelle l'ETUDE-SERVICE (port 8012 ou via Gateway 8090) et retourne les données d'étude de marché.
    Endpoint : GET /api/market/analyse/projet/{projet_id}/
    En cas d'erreur (injoignable, timeout, 503), retourne {}.
    """
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/market/analyse/projet/{projet_id}/"
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        donnees = response.json()
        logger.info("ETUDE-SERVICE: données reçues pour le projet %s", projet_id)
        return donnees
    except requests.exceptions.RequestException as exc:
        logger.warning(
            "ETUDE-SERVICE injoignable pour le projet %s (%s) — le chat continue sans ces données.",
            projet_id, exc,
        )
        return {}
    except ValueError as exc:
        logger.warning("Réponse JSON invalide reçue d'ETUDE-SERVICE : %s", exc)
        return {}
    except Exception as exc:
        logger.warning("ETUDE-SERVICE: erreur inattendue : %s", exc)
        return {}
