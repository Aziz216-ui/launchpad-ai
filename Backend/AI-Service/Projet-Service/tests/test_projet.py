"""
Tests du Projet-Service.

Classes :
- ProjetCRUDTest      : CRUD + actions activer/analyser
- AnalyseTest         : lecture et suppression des analyses
- HealthCheckTest     : endpoint /health/
- MoteurReglesTest    : moteur de regles (analyser_projet)
"""
from unittest.mock import patch, MagicMock
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from projet.models import Projet, AnalyseProjet
from projet.services.regles import analyser_projet


# ── Helpers ───────────────────────────────────────────────────────────────────

def _creer_projet(**kwargs):
    """Cree un projet avec des valeurs par defaut raisonnables."""
    defaults = {
        "entrepreneur_id": 1,
        "titre": "Projet Test",
        "idee": "Une idee innovante qui fait plus de cinquante caracteres pour passer le test des regles.",
        "objectifs": "Objectif tres clair et defini avec plus de trente caracteres.",
        "secteur": "Tech",
        "stade": Projet.Stade.IDEE,
        "public_cible": "Etudiants en informatique",
        "budget_estime": Decimal("50000.00"),
        "statut": Projet.Statut.BROUILLON,
    }
    defaults.update(kwargs)
    return Projet.objects.create(**defaults)


DONNEES_MARCHE_MOCK = {
    "niveau_concurrence": "moyen",
    "concurrents": [{"nom": "Concurrent A"}],
    "etudes": [{"titre": "Etude 1"}],
    "tendances": [{"nom": "IA", "evolution": "croissance"}],
}

RESULTAT_LLM_MOCK = {
    "forces": ["Force LLM 1", "Force LLM 2"],
    "faiblesses": ["Faiblesse LLM 1"],
    "score_global": 75,
    "resume": "Resume genere par le LLM.",
}


# ── ProjetCRUDTest ────────────────────────────────────────────────────────────

class ProjetCRUDTest(TestCase):
    """Tests CRUD du ProjetViewSet + actions metier."""

    def setUp(self):
        self.client = APIClient()
        self.projet_brouillon = _creer_projet(titre="Brouillon", statut=Projet.Statut.BROUILLON)
        self.projet_actif = _creer_projet(titre="Actif", statut=Projet.Statut.ACTIF)

    def test_list_projets(self):
        """GET /api/ai/projets/ retourne la liste paginee."""
        response = self.client.get("/api/ai/projets/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertEqual(len(response.data["results"]), 2)

    def test_list_filtrer_par_statut(self):
        """GET /api/ai/projets/?statut=brouillon filtre correctement."""
        response = self.client.get("/api/ai/projets/", {"statut": "brouillon"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["titre"], "Brouillon")

    def test_create_projet(self):
        """POST /api/ai/projets/ cree un projet."""
        data = {
            "entrepreneur_id": 99,
            "titre": "Nouveau Projet",
            "idee": "Une idee geniale",
            "secteur": "FinTech",
            "stade": "idee",
        }
        response = self.client.post("/api/ai/projets/", data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["titre"], "Nouveau Projet")
        self.assertEqual(response.data["statut"], "brouillon")

    def test_detail_projet(self):
        """GET /api/ai/projets/<id>/ retourne le detail."""
        response = self.client.get(f"/api/ai/projets/{self.projet_brouillon.pk}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["titre"], "Brouillon")

    def test_delete_brouillon_ok(self):
        """DELETE /api/ai/projets/<id>/ autorise si statut=brouillon."""
        response = self.client.delete(f"/api/ai/projets/{self.projet_brouillon.pk}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Projet.objects.filter(pk=self.projet_brouillon.pk).exists())

    def test_delete_actif_refuse(self):
        """DELETE /api/ai/projets/<id>/ refuse si statut=actif."""
        response = self.client.delete(f"/api/ai/projets/{self.projet_actif.pk}/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("erreur", response.data)
        self.assertTrue(Projet.objects.filter(pk=self.projet_actif.pk).exists())

    def test_activer(self):
        """POST /api/ai/projets/<id>/activer/ passe le statut a actif."""
        response = self.client.post(f"/api/ai/projets/{self.projet_brouillon.pk}/activer/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.projet_brouillon.refresh_from_db()
        self.assertEqual(self.projet_brouillon.statut, Projet.Statut.ACTIF)

    @patch("projet.services.market_client.recuperer_donnees_marche", return_value=DONNEES_MARCHE_MOCK)
    @patch("projet.services.llm.analyser_projet_llm", return_value=RESULTAT_LLM_MOCK)
    def test_analyser_llm(self, mock_llm, mock_market):
        """POST /projets/<id>/analyser/ avec LLM disponible."""
        response = self.client.post(f"/api/ai/projets/{self.projet_actif.pk}/analyser/")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["source"], "llm")
        self.assertEqual(response.data["score_global"], 75)
        mock_market.assert_called_once_with(self.projet_actif.pk)
        mock_llm.assert_called_once()

    @patch("projet.services.market_client.recuperer_donnees_marche", return_value={})
    @patch("projet.services.llm.analyser_projet_llm", return_value=None)
    def test_analyser_repli_regles(self, mock_llm, mock_market):
        """POST /projets/<id>/analyser/ — repli sur les regles si LLM indisponible."""
        response = self.client.post(f"/api/ai/projets/{self.projet_actif.pk}/analyser/")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["source"], "regles")
        self.assertIsInstance(response.data["forces"], list)
        self.assertIsInstance(response.data["faiblesses"], list)


# ── AnalyseTest ───────────────────────────────────────────────────────────────

class AnalyseTest(TestCase):
    """Tests du AnalyseProjetViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.projet = _creer_projet(statut=Projet.Statut.ACTIF)
        self.analyse = AnalyseProjet.objects.create(
            projet=self.projet,
            forces=["Force 1"],
            faiblesses=["Faiblesse 1"],
            score_global=65,
            resume="Test resume",
            source="regles",
        )

    def test_list_analyses(self):
        """GET /api/ai/analyses/ retourne la liste."""
        response = self.client.get("/api/ai/analyses/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_list_filtrer_par_projet(self):
        """GET /api/ai/analyses/?projet=<id> filtre par projet."""
        response = self.client.get("/api/ai/analyses/", {"projet": self.projet.pk})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)

    def test_detail_analyse(self):
        """GET /api/ai/analyses/<id>/ retourne le detail."""
        response = self.client.get(f"/api/ai/analyses/{self.analyse.pk}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["score_global"], 65)

    def test_delete_analyse(self):
        """DELETE /api/ai/analyses/<id>/ supprime l'analyse."""
        response = self.client.delete(f"/api/ai/analyses/{self.analyse.pk}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AnalyseProjet.objects.filter(pk=self.analyse.pk).exists())


# ── HealthCheckTest ───────────────────────────────────────────────────────────

class HealthCheckTest(TestCase):
    """Test du health check."""

    def test_health_check_up(self):
        """GET /api/ai/health/ retourne UP avec service 'projet-service'."""
        response = self.client.get("/api/ai/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "UP")
        self.assertEqual(response.data["service"], "projet-service")
        self.assertEqual(response.data["database"], "UP")


# ── MoteurReglesTest ──────────────────────────────────────────────────────────

class MoteurReglesTest(TestCase):
    """Tests du moteur de regles analyser_projet."""

    def test_projet_complet(self):
        """Projet avec tous les champs remplis obtient un bon score."""
        projet = _creer_projet()
        resultat = analyser_projet(projet, {})
        self.assertIn("forces", resultat)
        self.assertIn("faiblesses", resultat)
        self.assertIn("score_global", resultat)
        self.assertIn("resume", resultat)
        self.assertIsInstance(resultat["forces"], list)
        self.assertIsInstance(resultat["faiblesses"], list)
        self.assertGreaterEqual(resultat["score_global"], 50)

    def test_projet_minimal(self):
        """Projet avec champs vides obtient un score faible."""
        projet = _creer_projet(
            idee="courte",
            objectifs="",
            secteur="",
            public_cible="",
            budget_estime=None,
        )
        resultat = analyser_projet(projet, {})
        self.assertLess(resultat["score_global"], 50)
        self.assertTrue(len(resultat["faiblesses"]) > len(resultat["forces"]))

    def test_avec_donnees_marche_concurrence_faible(self):
        """La concurrence faible ajoute un bonus au score."""
        projet = _creer_projet()
        donnees_faible = {"niveau_concurrence": "faible", "concurrents": [], "etudes": [], "tendances": []}
        resultat = analyser_projet(projet, donnees_faible)
        self.assertGreater(resultat["score_global"], 60)
        forces_texte = " ".join(resultat["forces"])
        self.assertIn("opportunite", forces_texte.lower())

    def test_avec_donnees_marche_concurrence_elevee(self):
        """La concurrence elevee reduit le score."""
        projet = _creer_projet()
        donnees_elevee = {
            "niveau_concurrence": "eleve",
            "concurrents": [{"nom": "A"}, {"nom": "B"}],
            "etudes": [],
            "tendances": [],
        }
        resultat_sans = analyser_projet(projet, {})
        resultat_avec = analyser_projet(projet, donnees_elevee)
        self.assertLess(resultat_avec["score_global"], resultat_sans["score_global"])

    def test_tendances_croissance(self):
        """Les tendances en croissance ajoutent un bonus."""
        projet = _creer_projet()
        donnees = {
            "niveau_concurrence": "inconnu",
            "concurrents": [],
            "etudes": [],
            "tendances": [{"nom": "IA", "evolution": "croissance"}],
        }
        resultat = analyser_projet(projet, donnees)
        forces_texte = " ".join(resultat["forces"])
        self.assertIn("croissance", forces_texte.lower())

