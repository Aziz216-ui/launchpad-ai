"""
Tests APITestCase pour le Recommandation-Service.
Mocke les appels inter-services (Projet-Service, Market-Service, LLM).
"""
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from recommandation.models import Recommandation

PROJET_MOCK = {
    "id": 1,
    "titre": "Projet Test",
    "idee": "Une idee innovante",
    "objectifs": "Valider le marche",
    "secteur": "Tech",
    "stade": "idee",
    "public_cible": "Startups",
    "budget_estime": "50000.00",
}

ANALYSE_MOCK = {
    "id": 10,
    "forces": ["Bonne idee"],
    "faiblesses": ["Equipe reduite"],
    "score_global": 75,
}

MARCHE_MOCK = {
    "niveau_concurrence": "moyen",
    "concurrents": [],
}

class RecommandationCRUDTest(APITestCase):
    def setUp(self):
        self.reco = Recommandation.objects.create(
            projet_id=1,
            analyse_id=10,
            categorie="marche",
            titre="Etudier le marche",
            description="Faire 10 interviews",
            priorite="haute",
            ordre=1,
            statut="nouvelle",
        )

    def test_liste_recommandations(self):
        res = self.client.get("/api/ai/recommandations/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_changer_statut(self):
        res = self.client.patch(
            f"/api/ai/recommandations/{self.reco.id}/statut/",
            {"statut": "appliquee"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.reco.refresh_from_db()
        self.assertEqual(self.reco.statut, "appliquee")

    @patch("recommandation.services.projet_client.recuperer_projet", return_value=PROJET_MOCK)
    @patch("recommandation.services.projet_client.recuperer_derniere_analyse", return_value=ANALYSE_MOCK)
    @patch("recommandation.services.market_client.recuperer_donnees_marche", return_value=MARCHE_MOCK)
    @patch("recommandation.services.llm.generer_recommandations_llm", return_value=None)
    def test_generer_recommandations(self, mock_llm, mock_marche, mock_analyse, mock_proj):
        res = self.client.post(
            "/api/ai/recommandations/generer/",
            {"projet_id": 1},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(len(res.data) > 0)

class HealthCheckTest(APITestCase):
    def test_health(self):
        res = self.client.get("/api/ai/health/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "UP")
        self.assertEqual(res.data["service"], "recommandation-service")

