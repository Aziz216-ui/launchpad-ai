"""
Client REST pour communiquer avec Finance-Service (via Eureka ou l'API Gateway).
Utilisé comme repli pour enrichir les données d'événements RabbitMQ si le message est allégé.
"""
from __future__ import annotations

import logging
import os
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GATEWAY_URL = getattr(settings, "FINANCE_SERVICE_URL", os.getenv("FINANCE_SERVICE_URL", "http://localhost:8090"))


def recuperer_synthese_financiere(projet_id: str | int) -> dict | None:
    """
    Récupère la synthèse financière (chiffre d'affaires, marges, écart excédent/déficit)
    auprès du Prevision-Service via l'API Gateway.
    Endpoint : GET /api/finance/projets/{projetId}/synthese
    """
    try:
        formatted_id = int(projet_id)  # Finance attend un identifiant entier
    except (ValueError, TypeError):
        logger.warning("[FINANCE-CLIENT] Identifiant de projet non entier : %r", projet_id)
        return None
    url = f"{GATEWAY_URL}/api/finance/projets/{formatted_id}/synthese"
    try:
        response = requests.get(url, timeout=4)
        if response.status_code == 200:
            return response.json()
        logger.warning(
            "[FINANCE-CLIENT] Synthèse introuvable pour projet %s (id %s) (status HTTP %s)",
            projet_id,
            formatted_id,
            response.status_code,
        )
        return None
    except requests.RequestException as err:
        logger.info("[FINANCE-CLIENT] Finance-Service non joignable via REST (%s), utilisation des données du message RabbitMQ.", err)
        return None
