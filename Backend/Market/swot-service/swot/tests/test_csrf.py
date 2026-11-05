"""CSRF avec une session admin (POST depuis Swagger via l'API Gateway) et réglages du service."""

from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from market_commun.testing import CsrfTestsMixin
from swot.models import ElementSWOT


class CsrfTests(CsrfTestsMixin, APITestCase):
    url_creation = "swot-list"
    donnees_creation = {"etude_id": 1, "type": "force"}
    modele = ElementSWOT
    champ_texte = "description"
    admin_ajout = "admin:swot_elementswot_add"
    donnees_admin = {"etude_id": "1", "type": "force"}

    def setUp(self):
        # ETUDE-SERVICE simulé : l'étude 1 existe
        patcher = mock.patch("clients.etude_client.EtudeClient.exists", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        super().setUp()


class ReglagesServiceTests(SimpleTestCase):
    """Identité du service, utilisée par Eureka et la gateway."""

    def test_identite(self):
        self.assertEqual((settings.SERVICE_NAME, settings.SERVICE_PORT), ("swot-service", 8013))
        self.assertEqual(settings.EUREKA_APP_NAME, "SWOT-SERVICE")
        self.assertEqual(settings.EUREKA_HEALTH_PATH, "/api/market/swot/health/")
