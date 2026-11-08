"""CSRF avec une session admin (POST depuis Swagger via l'API Gateway) et réglages du service."""

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from market_commun.testing import CsrfTestsMixin
from secteurs.models import Secteur


class CsrfTests(CsrfTestsMixin, APITestCase):
    url_creation = "secteur-list"
    donnees_creation = {"description": "via la gateway"}
    modele = Secteur
    champ_texte = "nom"
    admin_ajout = "admin:secteurs_secteur_add"
    donnees_admin = {"description": ""}


class ReglagesServiceTests(SimpleTestCase):
    """Identité du service, utilisée par Eureka et la gateway."""

    def test_identite(self):
        self.assertEqual((settings.SERVICE_NAME, settings.SERVICE_PORT), ("secteur-service", 8010))
        self.assertEqual(settings.EUREKA_APP_NAME, "SECTEUR-SERVICE")
        self.assertEqual(settings.EUREKA_HEALTH_PATH, "/api/market/secteurs/health/")
