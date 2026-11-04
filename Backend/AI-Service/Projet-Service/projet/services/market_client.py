"""
Client HTTP pour le service d'Étude de marché (ETUDE-SERVICE).

Résolution de l'URL (ordre de priorité) :
  1. Découverte Eureka par nom de service (MARKET_SERVICE_NAME=ETUDE-SERVICE)
  2. Repli sur la variable d'env MARKET_SERVICE_URL
  3. Repli final sur http://localhost:8090 (API Gateway)

Le client est toujours non-bloquant : timeout court (5s), retourne {} sur toute erreur
(y compris 503 si le microservice est indisponible).
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
    """
    Tente de résoudre l'URL de base d'ETUDE-SERVICE via Eureka.
    Retourne l'URL résolue ou la passerelle de repli.
    """
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
    Appelle l'ETUDE-SERVICE (directement ou via la Gateway) et retourne les données d'étude de marché.
    Endpoint confirmé : GET /api/market/analyse/projet/{projet_id}/
    En cas d'erreur (injoignable, timeout, HTTP 503/404, Eureka KO), retourne {}.
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
            "ETUDE-SERVICE injoignable pour le projet %s (%s) — le service continue sans ces données.",
            projet_id, exc,
        )
        return {}
    except ValueError as exc:
        logger.warning("Réponse JSON invalide reçue d'ETUDE-SERVICE : %s", exc)
        return {}
    except Exception as exc:
        logger.warning("ETUDE-SERVICE: erreur inattendue : %s", exc)
        return {}
