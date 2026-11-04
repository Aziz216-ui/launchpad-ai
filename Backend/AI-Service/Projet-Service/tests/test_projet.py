"""
Tests unitaires et d'intégration APITestCase pour le Projet-Service.
Tous les appels à ETUDE-SERVICE et au LLM sont mockés.
"""
from unittest.mock import patch
import requests
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from projet.models import Projet, AnalyseProjet
from projet.services import regles, market_client


def creer_projet(statut="brouillon", entrepreneur_id=1, **kwargs):
    defaults = dict(
        entrepreneur_id=entrepreneur_id,
        titre="Projet Test",
        idee="Une idée bien documentée et innovante pour tester le service en profondeur.",
        objectifs="Valider le marché et les premiers clients en 3 mois.",
        secteur="Tech",
        stade="idee",
        public_cible="Startups et PME",
        budget_estime="50000.00",
        statut=statut,
    )
    defaults.update(kwargs)
    return Projet.objects.create(**defaults)


# Réponse complète formatée selon le nouveau contrat d'ETUDE-SERVICE
ETUDE_SERVICE_REPONSE_COMPLETE = {
    "projet_id": 1,
    "nombre_etudes": 1,
    "etudes": [
        {
            "id": 1,
            "titre": "Étude Marché Tech 2026",
            "secteur": "Tech",
            "taille_marche": "500M EUR",
            "taux_croissance": 12.5,
            "cible": "B2B",
            "zone_geographique": "France",
        }
    ],
    "secteurs": [],
    "concurrents": [
        {"id": 1, "nom": "Concurrent Leader", "prix_moyen": 150.0, "part_de_marche": 40.0},
        {"id": 2, "nom": "Challenger B", "prix_moyen": 120.0, "part_de_marche": 25.0},
    ],
    "tendances": [
        {"id": 1, "titre": "Adoption accélérée du Cloud", "impact": "positif"},
        {"id": 2, "titre": "Pression réglementaire", "impact": "negatif"},
    ],
    "niveau_concurrence": "eleve",
}

ETUDE_SERVICE_REPONSE_VIDE = {
    "projet_id": 1,
    "nombre_etudes": 0,
    "etudes": [],
    "secteurs": [],
    "concurrents": [],
    "tendances": [],
    "niveau_concurrence": "inconnu",
}


# ── Tests du Moteur de règles ─────────────────────────────────────────────────

class MoteurReglesTest(TestCase):
    def setUp(self):
        self.projet = creer_projet()

    def test_analyse_avec_donnees_completes(self):
        res = regles.analyser_projet(self.projet, ETUDE_SERVICE_REPONSE_COMPLETE)
        self.assertIn("score_global", res)
        # Concurrence élevée doit être signalée dans les faiblesses
        self.assertTrue(any("Concurrence élevée" in f for f in res["faiblesses"]))
        # Forte croissance (≥ 10%) dans les forces
        self.assertTrue(any("forte croissance" in f for f in res["forces"]))
        # Tendances positives dans les forces
        self.assertTrue(any("favorables" in f for f in res["forces"]))

    def test_analyse_projet_sans_etude(self):
        res = regles.analyser_projet(self.projet, ETUDE_SERVICE_REPONSE_VIDE)
        self.assertIn("score_global", res)
        self.assertNotIn("Concurrence élevée", " ".join(res["faiblesses"]))


# ── Tests Client HTTP (ETUDE-SERVICE) ──────────────────────────────────────────

class MarketClientTest(TestCase):
    @patch("requests.get")
    def test_recuperer_donnees_succes(self, mock_get):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = ETUDE_SERVICE_REPONSE_COMPLETE
        data = market_client.recuperer_donnees_marche(1)
        self.assertEqual(data["niveau_concurrence"], "eleve")
        self.assertEqual(len(data["concurrents"]), 2)

    @patch("requests.get")
    def test_recuperer_donnees_erreur_503(self, mock_get):
        mock_get.side_effect = requests.exceptions.HTTPError("503 Service Unavailable")
        data = market_client.recuperer_donnees_marche(1)
        self.assertEqual(data, {})

    @patch("requests.get")
    def test_recuperer_donnees_timeout(self, mock_get):
        mock_get.side_effect = requests.exceptions.Timeout("Read timed out")
        data = market_client.recuperer_donnees_marche(1)
        self.assertEqual(data, {})

    @patch("projet.services.market_client._resoudre_base_url", return_value="http://localhost:8090")
    @patch("requests.get")
    def test_repli_sur_gateway_quand_eureka_ko(self, mock_get, mock_url):
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = ETUDE_SERVICE_REPONSE_COMPLETE
        market_client.recuperer_donnees_marche(1)
        mock_get.assert_called_with("http://localhost:8090/api/market/analyse/projet/1/", timeout=5)


# ── Tests API Projet ──────────────────────────────────────────────────────────

class ProjetAPITest(APITestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif")

    @patch("projet.services.market_client.recuperer_donnees_marche", return_value=ETUDE_SERVICE_REPONSE_COMPLETE)
    @patch("projet.services.llm.analyser_projet_llm", return_value=None)
    def test_action_analyser_projet(self, mock_llm, mock_marche):
        res = self.client.post(f"/api/ai/projets/{self.projet.id}/analyser/")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn("score_global", res.data)
        self.assertTrue(any("Concurrence élevée" in f for f in res.data["faiblesses"]))

    def test_supprimer_brouillon_ok(self):
        p_brouillon = creer_projet(statut="brouillon", titre="Projet Brouillon")
        res = self.client.delete(f"/api/ai/projets/{p_brouillon.id}/")
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

    def test_supprimer_actif_refuse(self):
        res = self.client.delete(f"/api/ai/projets/{self.projet.id}/")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class HealthCheckTest(APITestCase):
    def test_health(self):
        res = self.client.get("/api/ai/health/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "UP")
        self.assertEqual(res.data["service"], "projet-service")
