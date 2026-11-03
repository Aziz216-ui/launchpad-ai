"""
Configuration Django du etude-service (LaunchPad AI, étude de marché).

Entités : EtudeMarche, Persona. Base PostgreSQL dédiée : etude_db.
Les réglages techniques communs (sécurité, CSRF, CORS, DRF, logs, Eureka, RabbitMQ) viennent
de la bibliothèque market-commun ; les secrets sont lus dans .env (voir .env.example).
"""

from pathlib import Path

from market_commun.reglages import reglages_service

BASE_DIR = Path(__file__).resolve().parent.parent

globals().update(reglages_service(
    base_dir=BASE_DIR,
    nom="etude-service",
    port=8012,
    app="etudes",
    ressource="etudes",
    eureka_app="ETUDE-SERVICE",
    nom_base="etude_db",
    titre="LaunchPad AI - Etude Service",
    description=(
        "Études de marché et personas : comparaison des prix, opportunités/menaces, "
        "rapport JSON/PDF et analyse d'un projet. Agrège SECTEUR-SERVICE, "
        "CONCURRENT-SERVICE et SWOT-SERVICE (découverts via Eureka)."
    ),
    # Services appelés : nom Eureka -> (variable de l'URL directe de repli, port local)
    services_appeles={
        "SECTEUR-SERVICE": ("SECTEUR_SERVICE_URL", 8010),
        "CONCURRENT-SERVICE": ("CONCURRENT_SERVICE_URL", 8011),
        "SWOT-SERVICE": ("SWOT_SERVICE_URL", 8013),
    },
    # Événements RabbitMQ publiés (routing keys) et consommés (queue -> routing key, handler)
    evenements_publies=["etude.finalisee", "etude.supprimee"],
    evenements_consommes={
        "etude.secteur-supprime": ("secteur.supprime", "etudes.handlers.secteur_supprime"),
        "etude.concurrent-supprime": ("concurrent.supprime", "etudes.handlers.concurrent_supprime"),
    },
))
