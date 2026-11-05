"""
Client HTTP pour le service d'Étude de marché (ETUDE-SERVICE).

Résolution de l'appel (ordre de priorité) :
  1. Découverte Eureka par nom de service (MARKET_SERVICE_NAME=ETUDE-SERVICE)
     via eureka_client.do_service(app_name, path, return_type="json")
  2. Repli sur la variable d'env MARKET_SERVICE_URL (ex. URL directe ou Gateway)
  3. Repli final sur http://localhost:8090 (API Gateway)

Le client est toujours non-bloquant : timeout court (5s), retourne {} sur toute erreur
(y compris 503 si le microservice est indisponible).
"""
from __future__ import annotations

import json
import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TIMEOUT = int(os.getenv("MARKET_CLIENT_TIMEOUT", "5"))  # 5 secondes
_DEFAULT_FALLBACK = "http://localhost:8090"


def recuperer_donnees_marche(projet_id: int) -> dict:
    """
    Appelle l'ETUDE-SERVICE (via Eureka en direct, sinon repli sur la Gateway / MARKET_SERVICE_URL).
    Endpoint confirmé : GET /api/market/analyse/projet/{projet_id}/
    En cas d'erreur (injoignable, timeout, HTTP 503/404, Eureka KO), retourne {}.
    """
    service_name = getattr(settings, "MARKET_SERVICE_NAME", os.getenv("MARKET_SERVICE_NAME", "ETUDE-SERVICE")).upper()
    path = f"/api/market/analyse/projet/{projet_id}/"

    # 1. Appel direct via Eureka si activé
    if os.getenv("EUREKA_ENABLED", "true").lower() not in ("false", "0", "no"):
        try:
            import py_eureka_client.eureka_client as eureka_client
            # Le 2e argument est le chemin relatif et non une fonction
            donnees = eureka_client.do_service(
                service_name,
                path,
                return_type="json",
                timeout=TIMEOUT,
            )
            if isinstance(donnees, dict) and donnees:
                logger.info("ETUDE-SERVICE (via Eureka): données reçues pour le projet %s", projet_id)
                return donnees
            if isinstance(donnees, str):
                parsed = json.loads(donnees)
                if isinstance(parsed, dict):
                    logger.info("ETUDE-SERVICE (via Eureka): données reçues pour le projet %s", projet_id)
                    return parsed
        except Exception as exc:
            logger.debug(
                "Eureka: impossible d'appeler '%s' directement (%s) — repli sur la gateway.",
                service_name, exc,
            )

    # 2. Repli sur MARKET_SERVICE_URL ou Gateway
    fallback_base = getattr(settings, "MARKET_SERVICE_URL", os.getenv("MARKET_SERVICE_URL", _DEFAULT_FALLBACK)).rstrip("/")
    url = f"{fallback_base}{path}"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        donnees = response.json()
        logger.info("ETUDE-SERVICE (via %s): données reçues pour le projet %s", fallback_base, projet_id)
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
