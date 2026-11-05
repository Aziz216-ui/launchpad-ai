"""
Gestionnaires d'événements (Event Handlers) pour Projet-Service.
Consomme les événements émis par les autres microservices (ex. Étude de marché).
"""
from __future__ import annotations

import logging
from django.db import transaction

from projet.models import Projet, AnalyseProjet
from projet.services import llm, regles, market_client
from projet.events.publisher import publier_evenement

logger = logging.getLogger(__name__)


def handle_etude_finalisee(data: dict) -> AnalyseProjet | None:
    """
    Consumer pour l'événement 'etude.finalisee' émis par etude-service (service Étude de marché).
    Exchange : market.events (topic)
    Queue : ai.etude-finalisee
    Routing key : etude.finalisee

    Action :
    1. Récupère le projet concerné.
    2. Récupère les données d'étude de marché produites par la collègue.
    3. Recalcule le Diagnostic complet (nouveau score, nouvelles forces/faiblesses).
    4. Émet 'diagnostic.termine' sur ai.events pour notifier Recommandation-Service.
    """
    projet_id = data.get("projet_id")
    etude_id = data.get("etude_id")

    if not projet_id:
        logger.warning("[CONSUMER] etude.finalisee: 'projet_id' manquant dans le payload.")
        return None

    projet = Projet.objects.filter(pk=projet_id).first()
    if not projet:
        logger.warning(
            "[CONSUMER] etude.finalisee: projet %s introuvable dans Projet-Service.",
            projet_id,
        )
        return None

    logger.info(
        "[CONSUMER] Traitement de 'etude.finalisee' pour le projet %s (etude_id=%s)...",
        projet_id, etude_id,
    )

    # Récupération des données de marché (soit déjà présentes dans le payload, soit appel REST)
    donnees_marche = (
        data.get("donnees_marche")
        or data.get("etude")
        or market_client.recuperer_donnees_marche(projet_id)
    )

    # Analyse IA (LLM avec repli sur les règles expertes)
    resultat = llm.analyser_projet_llm(projet, donnees_marche)
    source = AnalyseProjet.Source.LLM if resultat else AnalyseProjet.Source.REGLES
    if resultat is None:
        resultat = regles.analyser_projet(projet, donnees_marche)

    with transaction.atomic():
        analyse = AnalyseProjet.objects.create(
            projet=projet,
            forces=resultat.get("forces", []),
            faiblesses=resultat.get("faiblesses", []),
            score_global=resultat.get("score_global", 50),
            resume=resultat.get("resume", ""),
            source=source,
        )

        # Enchaînement événementiel : publication vers Recommandation-Service
        transaction.on_commit(
            lambda: publier_evenement(
                event="diagnostic.termine",
                data={
                    "projet_id": projet.pk,
                    "analyse_id": analyse.pk,
                    "score_global": analyse.score_global,
                    "forces": analyse.forces,
                    "faiblesses": analyse.faiblesses,
                    "resume": analyse.resume,
                    "source": analyse.source,
                    "projet": {
                        "id": projet.pk,
                        "titre": projet.titre,
                        "nom": projet.titre,
                        "idee": projet.idee,
                        "description": projet.idee,
                        "secteur": projet.secteur,
                        "stade": projet.stade,
                        "budget": float(projet.budget_estime) if projet.budget_estime is not None else None,
                        "budget_estime": float(projet.budget_estime) if projet.budget_estime is not None else None,
                    },
                },
            )
        )

    logger.info(
        "[CONSUMER] ai.etude-finalisee etude_id=%s projet_id=%s -> OK (analyse #%s générée, score %s%%)",
        etude_id, projet_id, analyse.pk, analyse.score_global,
    )
    return analyse

