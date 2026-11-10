"""
Client HTTP pour le service d'Étude de marché (ETUDE-SERVICE).

Résolution de l'appel (ordre de priorité) :
  1. Découverte Eureka par nom de service (MARKET_SERVICE_NAME=ETUDE-SERVICE)
     via eureka_client.do_service(app_name, path, return_type="json")
  2. Repli sur la variable d'env MARKET_SERVICE_URL (ex. URL directe ou Gateway)
  3. Repli final sur http://localhost:8090 (API Gateway)

Deux usages :
  - recuperer_donnees_marche() : enrichissement du diagnostic, non bloquant,
    retourne {} sur toute erreur (y compris 503 si le microservice est indisponible).
  - recuperer_secteurs_projet() : validation du secteur d'un projet, lève
    MarcheIndisponible si ETUDE-SERVICE ne répond pas (la vue renvoie alors 503).
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


class MarcheIndisponible(Exception):
    """ETUDE-SERVICE injoignable ou réponse inexploitable."""


def _chemin_analyse_projet(projet_id: int) -> str:
    return f"/api/market/analyse/projet/{projet_id}/"


def _resoudre_base_url() -> str:
    """URL de repli quand Eureka ne répond pas : MARKET_SERVICE_URL, sinon la Gateway."""
    base = getattr(settings, "MARKET_SERVICE_URL", None) or os.getenv("MARKET_SERVICE_URL", _DEFAULT_FALLBACK)
    return base.rstrip("/")


def _appeler_via_eureka(path: str) -> dict | None:
    """Appel direct via Eureka ; None si Eureka est désactivé, KO ou ne renvoie rien d'exploitable."""
    if os.getenv("EUREKA_ENABLED", "true").lower() in ("false", "0", "no"):
        return None
    service_name = getattr(
        settings, "MARKET_SERVICE_NAME", os.getenv("MARKET_SERVICE_NAME", "ETUDE-SERVICE")
    ).upper()
    try:
        import py_eureka_client.eureka_client as eureka_client
        # Le 2e argument est le chemin relatif et non une fonction
        donnees = eureka_client.do_service(service_name, path, return_type="json", timeout=TIMEOUT)
        if isinstance(donnees, str):
            donnees = json.loads(donnees)
        if isinstance(donnees, dict) and donnees:
            return donnees
    except Exception as exc:
        logger.debug(
            "Eureka: impossible d'appeler '%s' directement (%s) — repli sur la gateway.",
            service_name, exc,
        )
    return None


def _appeler_etude_service(path: str) -> dict:
    """
    GET sur ETUDE-SERVICE : Eureka d'abord, puis repli MARKET_SERVICE_URL / Gateway.
    Lève MarcheIndisponible si aucun des deux ne renvoie un objet JSON.
    """
    donnees = _appeler_via_eureka(path)
    if donnees is not None:
        logger.info("ETUDE-SERVICE (via Eureka): réponse reçue pour %s", path)
        return donnees

    base = _resoudre_base_url()
    url = f"{base}{path}"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        donnees = response.json()
    except requests.exceptions.RequestException as exc:
        raise MarcheIndisponible(f"ETUDE-SERVICE injoignable ({exc})") from exc
    except ValueError as exc:
        raise MarcheIndisponible(f"Réponse JSON invalide d'ETUDE-SERVICE ({exc})") from exc
    if not isinstance(donnees, dict):
        raise MarcheIndisponible("Réponse inattendue d'ETUDE-SERVICE (objet JSON attendu).")
    logger.info("ETUDE-SERVICE (via %s): réponse reçue pour %s", base, path)
    return donnees


def recuperer_donnees_marche(projet_id: int) -> dict:
    """
    Appelle l'ETUDE-SERVICE (via Eureka en direct, sinon repli sur la Gateway / MARKET_SERVICE_URL).
    Endpoint confirmé : GET /api/market/analyse/projet/{projet_id}/
    En cas d'erreur (injoignable, timeout, HTTP 503/404, Eureka KO), retourne {}.
    """
    try:
        return _appeler_etude_service(_chemin_analyse_projet(projet_id))
    except MarcheIndisponible as exc:
        logger.warning(
            "Projet %s : %s — le service continue sans ces données.", projet_id, exc,
        )
    except Exception as exc:
        logger.warning("ETUDE-SERVICE: erreur inattendue : %s", exc)
    return {}


def recuperer_secteurs_projet(projet_id: int) -> list[dict]:
    """
    Secteurs des études de marché du projet, [{"id": ..., "nom": ...}] (champ "secteurs"
    de GET /api/market/analyse/projet/{projet_id}/). Liste vide si le projet n'a aucune étude.
    Lève MarcheIndisponible si ETUDE-SERVICE ne répond pas ou si la réponse n'a pas de "secteurs".
    """
    donnees = _appeler_etude_service(_chemin_analyse_projet(projet_id))
    secteurs = donnees.get("secteurs")
    if not isinstance(secteurs, list):
        raise MarcheIndisponible("Réponse d'ETUDE-SERVICE sans liste de secteurs.")
    return [
        {"id": s["id"], "nom": s.get("nom", "")}
        for s in secteurs
        if isinstance(s, dict) and s.get("id") is not None
    ]
