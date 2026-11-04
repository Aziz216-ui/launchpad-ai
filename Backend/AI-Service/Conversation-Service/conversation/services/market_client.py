"""
Client HTTP pour le Market-Service (depuis Conversation-Service).
"""
from __future__ import annotations
import logging, os, requests
from django.conf import settings

logger = logging.getLogger(__name__)
TIMEOUT = 5
_DEFAULT_FALLBACK = "http://localhost:8005"

def _resoudre_base_url() -> str:
    service_name = getattr(settings, "MARKET_SERVICE_NAME", os.getenv("MARKET_SERVICE_NAME", "market-service"))
    try:
        import py_eureka_client.eureka_client as eureka_client
        url = eureka_client.do_service(service_name.upper(), lambda base_url: base_url)
        if url:
            return url.rstrip("/")
    except Exception as exc:
        logger.debug("Eureka: impossible de resoudre '%s' : %s", service_name, exc)
    return getattr(settings, "MARKET_SERVICE_URL", _DEFAULT_FALLBACK).rstrip("/")

def recuperer_donnees_marche(projet_id: int) -> dict:
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/market/analyse/projet/{projet_id}/"
        r = requests.get(url, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        logger.warning("Market-Service injoignable pour %s : %s", projet_id, exc)
        return {}

