"""CSRF avec une session admin (POST depuis Swagger via l'API Gateway) et réglages du service."""

from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from market_commun.testing import CsrfTestsMixin
from concurrents.models import Concurrent


class CsrfTests(CsrfTestsMixin, APITestCase):
    url_creation = "concurrent-list"
    donnees_creation = {"secteur_id": 1}
    modele = Concurrent
    champ_texte = "nom"
    admin_ajout = "admin:concurrents_concurrent_add"
    donnees_admin = {"secteur_id": "1", "prix_moyen": "0", "part_de_marche": "0"}

    def setUp(self):
        # SECTEUR-SERVICE simulé : le secteur 1 existe
        for methode, retour in [("exists", True), ("list", [{"id": 1, "nom": "FinTech"}])]:
            patcher = mock.patch(f"clients.secteur_client.SecteurClient.{methode}", return_value=retour)
            patcher.start()
            self.addCleanup(patcher.stop)
        super().setUp()


class ReglagesServiceTests(SimpleTestCase):
    """Identité du service, utilisée par Eureka et la gateway."""

    def test_identite(self):
        self.assertEqual((settings.SERVICE_NAME, settings.SERVICE_PORT), ("concurrent-service", 8011))
        self.assertEqual(settings.EUREKA_APP_NAME, "CONCURRENT-SERVICE")
        self.assertEqual(settings.EUREKA_HEALTH_PATH, "/api/market/concurrents/health/")
