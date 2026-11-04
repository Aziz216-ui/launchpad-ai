"""
Client HTTP pour le Projet-Service (depuis Conversation-Service).
"""
from __future__ import annotations
import logging, os, requests
from django.conf import settings

logger = logging.getLogger(__name__)
TIMEOUT = 5
_DEFAULT_FALLBACK = "http://localhost:8006"

def _resoudre_base_url() -> str:
    service_name = getattr(settings, "PROJET_SERVICE_NAME", os.getenv("PROJET_SERVICE_NAME", "projet-service"))
    try:
        import py_eureka_client.eureka_client as eureka_client
        url = eureka_client.do_service(service_name.upper(), lambda base_url: base_url)
        if url:
            return url.rstrip("/")
    except Exception as exc:
        logger.debug("Eureka: impossible de resoudre '%s' : %s", service_name, exc)
    return getattr(settings, "PROJET_SERVICE_URL", _DEFAULT_FALLBACK).rstrip("/")

def recuperer_projet(projet_id: int) -> dict:
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/ai/projets/{projet_id}/"
        r = requests.get(url, timeout=TIMEOUT)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        logger.warning("Projet-Service injoignable pour %s : %s", projet_id, exc)
        return {}

def recuperer_derniere_analyse(projet_id: int) -> dict | None:
    try:
        base_url = _resoudre_base_url()
        url = f"{base_url}/api/ai/analyses/?projet={projet_id}"
        r = requests.get(url, timeout=TIMEOUT)
        r.raise_for_status()
        data = r.json()
        results = data.get("results", data) if isinstance(data, dict) else data
        if isinstance(results, list) and results:
            return results[0]
        return None
    except Exception as exc:
        logger.warning("Projet-Service: analyses injoignables pour %s : %s", projet_id, exc)
        return None

