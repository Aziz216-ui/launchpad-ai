"""
Configuration Django du secteur-service (LaunchPad AI, étude de marché).

Entités : Secteur, Tendance. Base PostgreSQL dédiée : secteur_db.
Les réglages techniques communs (sécurité, CSRF, CORS, DRF, logs, Eureka, RabbitMQ) viennent
de la bibliothèque market-commun ; les secrets sont lus dans .env (voir .env.example).
"""

from pathlib import Path

from market_commun.reglages import reglages_service

BASE_DIR = Path(__file__).resolve().parent.parent

globals().update(reglages_service(
    base_dir=BASE_DIR,
    nom="secteur-service",
    port=8010,
    app="secteurs",
    ressource="secteurs",
    eureka_app="SECTEUR-SERVICE",
    nom_base="secteur_db",
    titre="LaunchPad AI - Secteur Service",
    description=(
        "Secteurs d'activité et tendances du marché. L'analyse d'un secteur interroge "
        "CONCURRENT-SERVICE (découvert via Eureka) pour les concurrents du secteur."
    ),
    # Services appelés : nom Eureka -> (variable de l'URL directe de repli, port local)
    services_appeles={
        "CONCURRENT-SERVICE": ("CONCURRENT_SERVICE_URL", 8011),
    },
    # Événements RabbitMQ publiés (routing keys) et consommés (queue -> routing key, handler)
    evenements_publies=["secteur.supprime"],
    evenements_consommes={},
))
