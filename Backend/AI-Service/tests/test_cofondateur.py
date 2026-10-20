"""
Tests APITestCase pour le Co-Fondateur IA.
Tous les appels au Market-Service et au LLM sont moques.
"""
from unittest.mock import patch
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase
from cofondateur.models import Projet, AnalyseProjet, Recommandation, Conversation, Message
from cofondateur.services import regles


# ── Helpers ────────────────────────────────────────────────────────────────────

def creer_projet(statut="brouillon", entrepreneur_id=1, **kwargs):
    defaults = dict(
        entrepreneur_id=entrepreneur_id, titre="Projet Test", idee="Une idee innovante pour tester le service.",
        objectifs="Valider le marche en 3 mois.", secteur="Tech", stade="idee",
        public_cible="Startups", budget_estime=None, statut=statut,
    )
    defaults.update(kwargs)
    return Projet.objects.create(**defaults)


MARCHE_MOCK = {
    "etudes": [{"id": 1, "titre": "Etude 2024"}],
    "secteurs": [{"id": 1, "nom": "Tech"}],
    "concurrents": [{"id": 1, "nom": "Concurrent A"}],
    "tendances": [{"id": 1, "nom": "IA", "evolution": "forte_croissance"}],
    "niveau_concurrence": "moyen",
}


# ── Moteur de regles (tests unitaires) ─────────────────────────────────────────

class ReglesTest(TestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif")

    def test_analyse_retourne_forces_et_faiblesses(self):
        res = regles.analyser_projet(self.projet, MARCHE_MOCK)
        self.assertIn("forces", res)
        self.assertIn("faiblesses", res)
        self.assertIsInstance(res["forces"], list)
        self.assertIsInstance(res["faiblesses"], list)
        self.assertGreaterEqual(res["score_global"], 0)
        self.assertLessEqual(res["score_global"], 100)

    def test_objectifs_vides_cree_faiblesse(self):
        self.projet.objectifs = ""
        self.projet.save()
        res = regles.analyser_projet(self.projet, {})
        faiblesses = " ".join(res["faiblesses"]).lower()
        self.assertIn("objectif", faiblesses)

    def test_sans_budget_cree_faiblesse(self):
        self.projet.budget_estime = None
        self.projet.save()
        res = regles.analyser_projet(self.projet, {})
        faiblesses = " ".join(res["faiblesses"]).lower()
        self.assertIn("budget", faiblesses)

    def test_concurrence_elevee_cree_faiblesse(self):
        res = regles.analyser_projet(self.projet, {"niveau_concurrence": "eleve"})
        faiblesses = " ".join(res["faiblesses"]).lower()
        self.assertTrue(any("concurr" in f for f in res["faiblesses"]))

    def test_recommandations_ordonnees(self):
        recos = regles.generer_recommandations(self.projet, None, MARCHE_MOCK)
        self.assertIsInstance(recos, list)
        self.assertGreater(len(recos), 0)
        for r in recos:
            self.assertIn("categorie", r)
            self.assertIn("titre", r)
            self.assertIn("ordre", r)

    def test_reponse_chat_non_vide(self):
        rep = regles.repondre_chat("Bonjour", self.projet, [], None, {})
        self.assertIsInstance(rep, str)
        self.assertGreater(len(rep), 10)

    def test_reponse_chat_contexte_financement(self):
        rep = regles.repondre_chat("Comment obtenir un financement ?", self.projet, [], None, {})
        self.assertIsInstance(rep, str)


# ── CRUD Projets ───────────────────────────────────────────────────────────────

class ProjetCRUDTest(APITestCase):
    def setUp(self):
        self.projet_brouillon = creer_projet(statut="brouillon")
        self.projet_actif = creer_projet(statut="actif", titre="Projet Actif")
        self.url = "/api/ai/projets/"

    def test_liste_projets(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertIn("results", r.data)

    def test_filtre_entrepreneur_id(self):
        r = self.client.get(f"{self.url}?entrepreneur_id=1")
        self.assertEqual(r.status_code, 200)

    def test_filtre_statut(self):
        r = self.client.get(f"{self.url}?statut=brouillon")
        self.assertEqual(r.status_code, 200)
        for p in r.data["results"]:
            self.assertEqual(p["statut"], "brouillon")

    def test_creation_projet(self):
        data = {"entrepreneur_id": 5, "titre": "Nouveau projet", "idee": "Test idee",
                "objectifs": "Test obj", "secteur": "Finance", "stade": "idee"}
        r = self.client.post(self.url, data, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["statut"], "brouillon")

    def test_detail_projet(self):
        r = self.client.get(f"{self.url}{self.projet_brouillon.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["titre"], self.projet_brouillon.titre)

    def test_suppression_brouillon_ok(self):
        r = self.client.delete(f"{self.url}{self.projet_brouillon.pk}/")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Projet.objects.filter(pk=self.projet_brouillon.pk).exists())

    def test_suppression_actif_refusee(self):
        r = self.client.delete(f"{self.url}{self.projet_actif.pk}/")
        self.assertEqual(r.status_code, 400)
        self.assertIn("erreur", r.data)
        self.assertTrue(Projet.objects.filter(pk=self.projet_actif.pk).exists())

    def test_activer_projet(self):
        r = self.client.post(f"{self.url}{self.projet_brouillon.pk}/activer/")
        self.assertEqual(r.status_code, 200)
        self.projet_brouillon.refresh_from_db()
        self.assertEqual(self.projet_brouillon.statut, "actif")

    @patch("cofondateur.views.market_client.recuperer_donnees_marche")
    @patch("cofondateur.views.llm.analyser_projet_llm")
    def test_analyser_projet(self, mock_llm, mock_market):
        mock_market.return_value = MARCHE_MOCK
        mock_llm.return_value = None  # repli sur les regles
        r = self.client.post(f"{self.url}{self.projet_brouillon.pk}/analyser/")
        self.assertEqual(r.status_code, 201)
        self.assertIn("forces", r.data)
        self.assertIn("faiblesses", r.data)
        self.assertIn("score_global", r.data)
        self.assertEqual(r.data["source"], "regles")

    @patch("cofondateur.views.market_client.recuperer_donnees_marche")
    @patch("cofondateur.views.llm.generer_recommandations_llm")
    def test_generer_recommandations(self, mock_llm, mock_market):
        mock_market.return_value = MARCHE_MOCK
        mock_llm.return_value = None
        r = self.client.post(f"{self.url}{self.projet_brouillon.pk}/recommandations/generer/")
        self.assertEqual(r.status_code, 201)
        self.assertIsInstance(r.data, list)
        self.assertGreater(len(r.data), 0)

    @patch("cofondateur.views.market_client.recuperer_donnees_marche")
    def test_analyser_market_injoignable(self, mock_market):
        """Le service continue meme si le Market-Service est injoignable."""
        mock_market.return_value = {}  # market client retourne {} si injoignable
        r = self.client.post(f"{self.url}{self.projet_brouillon.pk}/analyser/")
        self.assertEqual(r.status_code, 201)


# ── Conversations ──────────────────────────────────────────────────────────────

class ConversationTest(APITestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif")
        self.conv = Conversation.objects.create(projet=self.projet, titre="Test conv")
        self.url = "/api/ai/conversations/"

    def test_liste_conversations(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)

    def test_filtre_projet(self):
        r = self.client.get(f"{self.url}?projet={self.projet.pk}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 1)

    def test_detail_inclut_messages(self):
        Message.objects.create(conversation=self.conv, role="utilisateur", contenu="Bonjour")
        r = self.client.get(f"{self.url}{self.conv.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("messages", r.data)
        self.assertEqual(len(r.data["messages"]), 1)

    @patch("cofondateur.views.market_client.recuperer_donnees_marche")
    @patch("cofondateur.views.llm.repondre_chat_llm")
    def test_envoyer_message_mode_regles(self, mock_llm, mock_market):
        """Sans LLM, la reponse est generee par les regles."""
        mock_market.return_value = {}
        mock_llm.return_value = None
        r = self.client.post(
            f"{self.url}{self.conv.pk}/messages/",
            {"contenu": "Comment valider mon idee ?"},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(len(r.data), 2)
        self.assertEqual(r.data[0]["role"], "utilisateur")
        self.assertEqual(r.data[1]["role"], "assistant")

    @patch("cofondateur.views.market_client.recuperer_donnees_marche")
    @patch("cofondateur.views.llm.repondre_chat_llm")
    def test_envoyer_message_mode_llm(self, mock_llm, mock_market):
        """Avec LLM disponible, la reponse LLM est utilisee."""
        mock_market.return_value = MARCHE_MOCK
        mock_llm.return_value = "Super reponse du LLM."
        r = self.client.post(
            f"{self.url}{self.conv.pk}/messages/",
            {"contenu": "Aidez-moi avec mon projet."},
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data[1]["contenu"], "Super reponse du LLM.")


# ── Recommandations ────────────────────────────────────────────────────────────

class RecommandationTest(APITestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif")
        self.reco = Recommandation.objects.create(
            projet=self.projet, categorie="marche", titre="Test reco",
            description="Description test.", priorite="haute", ordre=1,
        )
        self.url = "/api/ai/recommandations/"

    def test_liste_recommandations(self):
        r = self.client.get(self.url)
        self.assertEqual(r.status_code, 200)

    def test_filtre_categorie(self):
        r = self.client.get(f"{self.url}?categorie=marche")
        self.assertEqual(r.status_code, 200)

    def test_filtre_priorite(self):
        r = self.client.get(f"{self.url}?priorite=haute")
        self.assertEqual(r.status_code, 200)

    def test_filtre_statut(self):
        r = self.client.get(f"{self.url}?statut=nouvelle")
        self.assertEqual(r.status_code, 200)

    def test_changement_statut_appliquee(self):
        r = self.client.patch(f"{self.url}{self.reco.pk}/statut/", {"statut": "appliquee"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["statut"], "appliquee")

    def test_changement_statut_ignoree(self):
        r = self.client.patch(f"{self.url}{self.reco.pk}/statut/", {"statut": "ignoree"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_statut_invalide_retourne_400(self):
        r = self.client.patch(f"{self.url}{self.reco.pk}/statut/", {"statut": "invalide"}, format="json")
        self.assertEqual(r.status_code, 400)


# ── Analyses ───────────────────────────────────────────────────────────────────

class AnalyseTest(APITestCase):
    def setUp(self):
        self.projet = creer_projet(statut="actif")
        self.analyse = AnalyseProjet.objects.create(
            projet=self.projet, forces=["Force 1"], faiblesses=["Faiblesse 1"],
            score_global=65, resume="Test.", source="regles",
        )

    def test_liste_analyses(self):
        r = self.client.get("/api/ai/analyses/")
        self.assertEqual(r.status_code, 200)

    def test_detail_analyse(self):
        r = self.client.get(f"/api/ai/analyses/{self.analyse.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("forces", r.data)

    def test_suppression_analyse(self):
        r = self.client.delete(f"/api/ai/analyses/{self.analyse.pk}/")
        self.assertEqual(r.status_code, 204)


# ── Health check ───────────────────────────────────────────────────────────────

class HealthCheckTest(APITestCase):
    def test_health(self):
        r = self.client.get("/api/ai/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "UP")
        self.assertEqual(r.data["service"], "cofondateur-ia")
