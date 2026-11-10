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


# ── Secteur du projet : limité aux secteurs de ses études de marché ──────────

def reponse_etude_service(*secteurs):
    """Réponse d'ETUDE-SERVICE (analyse/projet) avec les secteurs (id, nom) donnés."""
    return {
        **ETUDE_SERVICE_REPONSE_VIDE,
        "nombre_etudes": len(secteurs),
        "secteurs": [
            {"id": sid, "nom": nom, "nombre_concurrents": 0, "concurrents": [], "tendances": []}
            for sid, nom in secteurs
        ],
    }


# Eureka désactivé : l'appel passe par requests.get (mocké) sur l'URL de repli.
@patch("projet.services.market_client._appeler_via_eureka", return_value=None)
class SecteurClientTest(TestCase):
    @patch("requests.get")
    def test_secteurs_du_projet(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = reponse_etude_service((1, "FinTech"), (2, "EdTech"))
        self.assertEqual(
            market_client.recuperer_secteurs_projet(7),
            [{"id": 1, "nom": "FinTech"}, {"id": 2, "nom": "EdTech"}],
        )
        self.assertTrue(mock_get.call_args.args[0].endswith("/api/market/analyse/projet/7/"))

    @patch("requests.get")
    def test_projet_sans_etude_liste_vide(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = ETUDE_SERVICE_REPONSE_VIDE
        self.assertEqual(market_client.recuperer_secteurs_projet(7), [])

    @patch("requests.get", side_effect=requests.exceptions.ConnectionError("refused"))
    def test_service_injoignable_leve_une_erreur(self, _get, _eureka):
        with self.assertRaises(market_client.MarcheIndisponible):
            market_client.recuperer_secteurs_projet(7)

    @patch("requests.get")
    def test_reponse_sans_secteurs_leve_une_erreur(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = {"detail": "inattendu"}
        with self.assertRaises(market_client.MarcheIndisponible):
            market_client.recuperer_secteurs_projet(7)


@patch("projet.services.market_client._appeler_via_eureka", return_value=None)
class ProjetSecteurAPITest(APITestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif", secteur="Technologie / Marketplace")
        self.url = f"/api/ai/projets/{self.projet.id}/"

    @patch("requests.get")
    def test_patch_secteur_valide(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = reponse_etude_service((1, "FinTech"), (2, "EdTech"))
        res = self.client.patch(self.url, {"secteur_id": 2}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["secteur_id"], 2)
        self.assertEqual(res.data["secteur"], "EdTech")
        self.projet.refresh_from_db()
        self.assertEqual((self.projet.secteur_id, self.projet.secteur), (2, "EdTech"))

    @patch("requests.get")
    def test_put_secteur_valide(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = reponse_etude_service((1, "FinTech"))
        donnees = {
            "entrepreneur_id": 1, "titre": "Projet renommé", "stade": "prototype",
            "statut": "actif", "secteur": "texte ignoré", "secteur_id": 1,
        }
        res = self.client.put(self.url, donnees, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual((res.data["secteur_id"], res.data["secteur"]), (1, "FinTech"))

    @patch("requests.get")
    def test_patch_secteur_sans_etude_refuse(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = reponse_etude_service((1, "FinTech"))
        res = self.client.patch(self.url, {"secteur_id": 3, "titre": "Ne doit pas changer"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data["secteur_id"], ["Ce secteur n'a pas d'étude de marché pour ce projet."])
        self.projet.refresh_from_db()
        self.assertEqual(self.projet.titre, "Projet Test")
        self.assertIsNone(self.projet.secteur_id)

    @patch("requests.get")
    def test_patch_projet_sans_aucune_etude_refuse(self, mock_get, _eureka):
        mock_get.return_value.json.return_value = ETUDE_SERVICE_REPONSE_VIDE
        res = self.client.patch(self.url, {"secteur_id": 1}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("requests.get", side_effect=requests.exceptions.ConnectionError("refused"))
    def test_etude_service_indisponible_503_sans_modification(self, _get, _eureka):
        res = self.client.patch(self.url, {"secteur_id": 1, "titre": "Ne doit pas changer"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("Étude de marché est indisponible", res.data["detail"])
        self.projet.refresh_from_db()
        self.assertEqual(self.projet.titre, "Projet Test")
        self.assertEqual(self.projet.secteur, "Technologie / Marketplace")
        self.assertIsNone(self.projet.secteur_id)

    @patch("requests.get")
    def test_patch_sans_secteur_id_n_appelle_pas_le_marche(self, mock_get, _eureka):
        res = self.client.patch(self.url, {"stade": "lancement"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        mock_get.assert_not_called()

    @patch("requests.get")
    def test_creation_avec_secteur_id_refusee(self, mock_get, _eureka):
        res = self.client.post(
            "/api/ai/projets/", {"entrepreneur_id": 1, "titre": "Nouveau", "secteur_id": 1}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        mock_get.assert_not_called()


class HealthCheckTest(APITestCase):
    def test_health(self):
        res = self.client.get("/api/ai/health/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "UP")
        self.assertEqual(res.data["service"], "projet-service")
