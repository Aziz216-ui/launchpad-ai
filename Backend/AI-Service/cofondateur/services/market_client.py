"""
Client HTTP pour le Market-Service.

Resolution de l'URL (ordre de priorite) :
  1. Decouverte Eureka par nom de service (MARKET_SERVICE_NAME)
  2. Repli sur la variable d'env MARKET_SERVICE_URL
  3. Repli final sur http://localhost:8005

Le client est toujours non-bloquant : timeout court, retourne {} sur toute erreur.

TODO: confirmer le chemin exact de l'endpoint avec le collegue (Market-Service).
      Actuellement : GET <base_url>/api/market/analyse/projet/<projet_id>/
"""
from __future__ import annotations

import logging
import os

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = 5  # secondes
_DEFAULT_FALLBACK = "http://localhost:8005"


def _resoudre_base_url() -> str:
    """
    Tente de resoudre l'URL de base du Market-Service via Eureka.
    Retourne l'URL de base (sans chemin) ou la valeur de repli.
    """
    service_name = getattr(settings, "MARKET_SERVICE_NAME", os.getenv("MARKET_SERVICE_NAME", "market-service"))
    try:
        import py_eureka_client.eureka_client as eureka_client  # noqa: WPS433
        # get_service_url renvoie l'URL complete d'une instance enregistree
        url = eureka_client.do_service(
            service_name.upper(),
            lambda base_url: base_url,  # on veut juste l'URL de base
        )
        if url:
            logger.debug("Market-Service resolu via Eureka : %s", url)
            return url.rstrip("/")
    except Exception as exc:  # noqa: BLE001
        logger.debug("Eureka: impossible de resoudre '%s' : %s — repli sur env.", service_name, exc)

    # Repli sur variable d'environnement
    fallback = getattr(settings, "MARKET_SERVICE_URL", _DEFAULT_FALLBACK)
    return fallback.rstrip("/")


def recuperer_donnees_marche(projet_id: int) -> dict:
    """
    Appelle le Market-Service et retourne les donnees de marche.
    En cas d'erreur (injoignable, timeout, HTTP non-200, Eureka KO), retourne {}.

    TODO: verifier le chemin exact avec le collegue si different de /api/market/analyse/projet/<id>/
    """
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/market/analyse/projet/{projet_id}/"
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        donnees = response.json()
        logger.info("Market-Service: donnees recues pour le projet %s", projet_id)
        return donnees
    except requests.exceptions.RequestException as exc:
        logger.warning(
            "Market-Service injoignable pour le projet %s : %s — le service continue sans ces donnees.",
            projet_id, exc,
        )
        return {}
    except ValueError as exc:
        logger.warning("Reponse JSON invalide du Market-Service : %s", exc)
        return {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Market-Service: erreur inattendue : %s", exc)
        return {}
