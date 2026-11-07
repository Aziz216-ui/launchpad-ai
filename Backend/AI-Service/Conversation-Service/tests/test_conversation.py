"""
Tests APITestCase pour le Conversation-Service.
Mocke les appels inter-services (Projet-Service, Market-Service, LLM).
"""
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from conversation.models import Conversation, Message

PROJET_MOCK = {
    "id": 1,
    "titre": "Projet Test",
    "stade": "prototype",
    "secteur": "Tech",
    "budget_estime": "100000.00",
}

class ConversationCRUDTest(APITestCase):
    def setUp(self):
        self.conv = Conversation.objects.create(projet_id=1, titre="Session test")
        self.msg = Message.objects.create(
            conversation=self.conv, role="utilisateur", contenu="Test"
        )

    def test_liste_conversations(self):
        res = self.client.get("/api/ai/conversations/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_detail_conversation(self):
        res = self.client.get(f"/api/ai/conversations/{self.conv.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("messages", res.data)

    @patch("conversation.services.projet_client.recuperer_projet", return_value=PROJET_MOCK)
    @patch("conversation.services.projet_client.recuperer_derniere_analyse", return_value=None)
    @patch("conversation.services.market_client.recuperer_donnees_marche", return_value={})
    @patch("conversation.services.llm.repondre_chat_llm", return_value=None)
    def test_envoyer_message(self, mock_llm, mock_marche, mock_analyse, mock_proj):
        res = self.client.post(
            f"/api/ai/conversations/{self.conv.id}/messages/",
            {"contenu": "Bonjour, comment financer mon projet ?"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(res.data), 2)  # msg user + msg assistant

class HealthCheckTest(APITestCase):
    def test_health(self):
        res = self.client.get("/api/ai/health/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["status"], "UP")
        self.assertEqual(res.data["service"], "conversation-service")

