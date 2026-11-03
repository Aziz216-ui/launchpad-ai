"""CSRF avec une session admin (POST depuis Swagger via l'API Gateway) et réglages du service."""

from unittest import mock

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from market_commun.testing import CsrfTestsMixin
from etudes.models import EtudeMarche


class CsrfTests(CsrfTestsMixin, APITestCase):
    url_creation = "etude-list"
    donnees_creation = {"projet_id": 1, "secteur_id": 1}
    modele = EtudeMarche
    champ_texte = "titre"
    admin_ajout = "admin:etudes_etudemarche_add"
    # Formulaire d'ajout d'une étude dans l'admin (inline personas vide)
    donnees_admin = {
        "projet_id": "1", "statut": "brouillon", "secteur_id": "1", "taille_marche": "0", "taux_croissance": "0",
        "concurrent_ids": "[]", "tendance_ids": "[]",
        "personas-TOTAL_FORMS": "0", "personas-INITIAL_FORMS": "0",
        "personas-MIN_NUM_FORMS": "0", "personas-MAX_NUM_FORMS": "1000",
    }

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
        self.assertEqual((settings.SERVICE_NAME, settings.SERVICE_PORT), ("etude-service", 8012))
        self.assertEqual(settings.EUREKA_APP_NAME, "ETUDE-SERVICE")
        self.assertEqual(settings.EUREKA_HEALTH_PATH, "/api/market/etudes/health/")
