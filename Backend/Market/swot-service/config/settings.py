"""
Configuration Django du swot-service (LaunchPad AI, étude de marché).

Entités : ElementSWOT. Base PostgreSQL dédiée : swot_db.
Les réglages techniques communs (sécurité, CSRF, CORS, DRF, logs, Eureka, RabbitMQ) viennent
de la bibliothèque market-commun ; les secrets sont lus dans .env (voir .env.example).
"""

from pathlib import Path

from market_commun.reglages import reglages_service

BASE_DIR = Path(__file__).resolve().parent.parent

globals().update(reglages_service(
    base_dir=BASE_DIR,
    nom="swot-service",
    port=8013,
    app="swot",
    ressource="swot",
    eureka_app="SWOT-SERVICE",
    nom_base="swot_db",
    titre="LaunchPad AI - SWOT Service",
    description=(
        "Éléments SWOT des études (saisie manuelle) et génération automatique par règles, "
        "à partir des données d'ETUDE-SERVICE (découvert via Eureka)."
    ),
    # Services appelés : nom Eureka -> (variable de l'URL directe de repli, port local)
    services_appeles={
        "ETUDE-SERVICE": ("ETUDE_SERVICE_URL", 8012),
    },
    # Événements RabbitMQ publiés (routing keys) et consommés (queue -> routing key, handler)
    evenements_publies=[],
    evenements_consommes={
        "swot.etude-finalisee": ("etude.finalisee", "swot.handlers.etude_finalisee"),
        "swot.etude-supprimee": ("etude.supprimee", "swot.handlers.etude_supprimee"),
    },
))
