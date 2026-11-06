"""
Configuration Django du concurrent-service (LaunchPad AI, étude de marché).

Entités : Concurrent. Base PostgreSQL dédiée : concurrent_db.
Les réglages techniques communs (sécurité, CSRF, CORS, DRF, logs, Eureka, RabbitMQ) viennent
de la bibliothèque market-commun ; les secrets sont lus dans .env (voir .env.example).
"""

from pathlib import Path

from market_commun.reglages import reglages_service

BASE_DIR = Path(__file__).resolve().parent.parent

globals().update(reglages_service(
    base_dir=BASE_DIR,
    nom="concurrent-service",
    port=8011,
    app="concurrents",
    ressource="concurrents",
    eureka_app="CONCURRENT-SERVICE",
    nom_base="concurrent_db",
    titre="LaunchPad AI - Concurrent Service",
    description=(
        "Concurrents des secteurs (prix, parts de marché, forces/faiblesses). À la "
        "création et à la modification, le secteur est vérifié auprès de SECTEUR-SERVICE "
        "(Eureka)."
    ),
    # Services appelés : nom Eureka -> (variable de l'URL directe de repli, port local)
    services_appeles={
        "SECTEUR-SERVICE": ("SECTEUR_SERVICE_URL", 8010),
    },
    # Événements RabbitMQ publiés (routing keys) et consommés (queue -> routing key, handler)
    evenements_publies=["concurrent.supprime"],
    evenements_consommes={
        "concurrent.secteur-supprime": ("secteur.supprime", "concurrents.handlers.secteur_supprime"),
    },
))
