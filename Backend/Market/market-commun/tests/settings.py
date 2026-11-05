"""Réglages des tests de market-commun : ceux d'un service fictif, base SQLite en mémoire."""

import os
from pathlib import Path

os.environ.setdefault("DB_ENGINE", "sqlite")
os.environ.setdefault("DEBUG", "True")  # pas de secrets à fournir pour les tests

from market_commun.reglages import reglages_service  # noqa: E402

globals().update(reglages_service(
    base_dir=Path(__file__).resolve().parent, nom="test-service", port=8099, app="tests",
    ressource="objets", eureka_app="TEST-SERVICE", nom_base="test_db",
    titre="Tests market-commun", description="Service fictif des tests",
    services_appeles={"TEST-SERVICE": ("TEST_SERVICE_URL", 9000)},
    evenements_publies=["objet.supprime"],
))
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
ROOT_URLCONF = "tests.urls"
