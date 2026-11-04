"""
Client HTTP pour le Projet-Service.

Resolution de l'URL (ordre de priorite) :
  1. Decouverte Eureka par nom de service (PROJET_SERVICE_NAME)
  2. Repli sur la variable d'env PROJET_SERVICE_URL
  3. Repli final sur http://localhost:8006
"""
from __future__ import annotations

import logging
import os

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = 2  # secondes
_DEFAULT_FALLBACK = "http://localhost:8006"


def _resoudre_base_url() -> str:
    if os.getenv("EUREKA_ENABLED", "true").lower() in ("false", "0", "no"):
        fallback = getattr(settings, "PROJET_SERVICE_URL", getattr(settings, "MARKET_SERVICE_URL", _DEFAULT_FALLBACK))
        return fallback.rstrip("/")
    """Resout l'URL de base du Projet-Service via Eureka ou repli."""
    service_name = getattr(settings, "PROJET_SERVICE_NAME", os.getenv("PROJET_SERVICE_NAME", "projet-service"))
    try:
        import py_eureka_client.eureka_client as eureka_client  # noqa: WPS433
        url = eureka_client.do_service(
            service_name.upper(),
            lambda base_url: base_url,
        )
        if url:
            logger.debug("Projet-Service resolu via Eureka : %s", url)
            return url.rstrip("/")
    except Exception as exc:  # noqa: BLE001
        logger.debug("Eureka: impossible de resoudre '%s' : %s — repli sur env.", service_name, exc)

    fallback = getattr(settings, "PROJET_SERVICE_URL", _DEFAULT_FALLBACK)
    return fallback.rstrip("/")


def recuperer_projet(projet_id: int) -> dict:
    """
    GET /api/ai/projets/<id>/ — retourne les donnees du projet ou {}.
    """
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/ai/projets/{projet_id}/"
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        donnees = response.json()
        logger.info("Projet-Service: donnees recues pour le projet %s", projet_id)
        return donnees
    except requests.exceptions.RequestException as exc:
        logger.warning("Projet-Service injoignable pour le projet %s : %s", projet_id, exc)
        return {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Projet-Service: erreur inattendue : %s", exc)
        return {}


def recuperer_derniere_analyse(projet_id: int) -> dict | None:
    """
    GET /api/ai/analyses/?projet=<id> — retourne la derniere analyse ou None.
    """
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/ai/analyses/?projet={projet_id}"
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()
        # DRF pagination : les resultats sont dans "results"
        results = data.get("results", data) if isinstance(data, dict) else data
        if isinstance(results, list) and results:
            return results[0]  # Le plus recent (ordonne par -date_creation)
        return None
    except requests.exceptions.RequestException as exc:
        logger.warning("Projet-Service: analyses injoignables pour projet %s : %s", projet_id, exc)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Projet-Service: erreur inattendue : %s", exc)
        return None

