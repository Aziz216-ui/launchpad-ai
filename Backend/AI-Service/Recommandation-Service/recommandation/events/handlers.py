"""
Gestionnaires d'événements (Event Handlers) pour Recommandation-Service.
Exécutés lors de la réception d'un message RabbitMQ.
"""
from __future__ import annotations

import logging
from recommandation.models import Recommandation
from recommandation.services import projet_client, market_client, llm, regles

logger = logging.getLogger(__name__)


def handle_diagnostic_termine(data: dict) -> int:
    """
    Consumer pour l'événement 'diagnostic.termine' émis par Projet-Service.
    Génère automatiquement les recommandations pour le projet sans bloquer l'utilisateur.
    """
    projet_id = data.get("projet_id")
    analyse_id = data.get("analyse_id")

    if not projet_id:
        logger.warning("[CONSUMER] diagnostic.termine: projet_id manquant dans les données.")
        return 0

    # 1. Récupération des données du projet (via client REST ou fallback sur le payload de l'événement)
    projet_data = projet_client.recuperer_projet(projet_id)
    if not projet_data and isinstance(data.get("projet"), dict):
        projet_data = data["projet"]
    if not projet_data:
        logger.warning("[CONSUMER] diagnostic.termine: projet %s introuvable via Projet-Service.", projet_id)
        return 0

    # 2. Données de l'analyse (passées dans l'événement ou récupérées)
    analyse_data = {
        "id": analyse_id,
        "score_global": data.get("score_global", 50),
        "forces": data.get("forces", []),
        "faiblesses": data.get("faiblesses", []),
        "resume": data.get("resume", ""),
    }

    # 3. Données de marché (si disponibles)
    donnees_marche = market_client.recuperer_donnees_marche(projet_id)

    # 4. Génération LLM ou règles expertes
    donnees_finance = data.get("finance") or {}
    recos_data = llm.generer_recommandations_llm(projet_data, analyse_data, donnees_marche)
    if recos_data is None:
        recos_data = regles.generer_recommandations(projet_data, analyse_data, donnees_marche, donnees_finance)

    # 5. Supprimer les anciennes recommandations non appliquées
    Recommandation.objects.filter(
        projet_id=projet_id,
        statut=Recommandation.Statut.NOUVELLE,
    ).delete()

    # 6. Sauvegarder les nouvelles recommandations
    recos_creees = []
    for r in recos_data:
        reco = Recommandation.objects.create(
            projet_id=projet_id,
            analyse_id=analyse_id,
            categorie=r.get("categorie", "marche"),
            titre=r.get("titre", ""),
            description=r.get("description", ""),
            priorite=r.get("priorite", "moyenne"),
            ordre=r.get("ordre", 1),
            statut=Recommandation.Statut.NOUVELLE,
        )
        recos_creees.append(reco)

    count = len(recos_creees)
    logger.info(
        "[CONSUMER] diagnostic.termine projet_id=%s analyse_id=%s -> OK (%s recommandation(s) générée(s))",
        projet_id, analyse_id, count,
    )
    return count
