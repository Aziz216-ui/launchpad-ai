"""Tests des événements RabbitMQ du concurrent-service (publication mockée, handlers appelés directement)."""

import json
from unittest import mock

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from concurrents.handlers import secteur_supprime
from concurrents.models import Concurrent
from evenements import consommateur, producteur

from .test_api import FINTECH, EDTECH, SecteurServiceMockeMixin


class PublicationTests(SecteurServiceMockeMixin, APITestCase):
    @mock.patch("evenements.producteur.envoyer")
    def test_suppression_publie_concurrent_supprime(self, envoyer):
        concurrent = Concurrent.objects.create(nom="Flouci", secteur_id=FINTECH)
        with self.assertLogs("evenements.producteur", "INFO") as logs, self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("concurrent-detail", args=[concurrent.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        message = envoyer.call_args.args[0]
        self.assertEqual(message["event"], "concurrent.supprime")
        self.assertEqual(message["data"], {"concurrent_id": concurrent.id, "secteur_id": FINTECH})
        self.assertIn(f"[PRODUCER] concurrent.supprime concurrent_id={concurrent.id}", logs.output[0])

    @mock.patch("evenements.producteur.envoyer")
    def test_creation_ne_publie_rien(self, envoyer):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse("concurrent-list"), {"nom": "X", "secteur_id": FINTECH}, format="json")
        envoyer.assert_not_called()

    def test_concurrent_sans_secteur_lisible_et_rattachable(self):
        concurrent = Concurrent.objects.create(nom="Orphelin", secteur_id=None)
        data = self.client.get(reverse("concurrent-detail", args=[concurrent.id])).json()
        self.assertEqual((data["secteur"], data["secteur_id"], data["secteur_nom"]), (None, None, None))
        response = self.client.patch(reverse("concurrent-detail", args=[concurrent.id]), {"secteur_id": EDTECH},
                                     format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["secteur_nom"], "EdTech")


class SecteurSupprimeTests(APITestCase):
    """Handler de la queue concurrent.secteur-supprime."""

    QUEUE = "concurrent.secteur-supprime"

    def setUp(self):
        self.lies = [Concurrent.objects.create(nom=n, secteur_id=FINTECH) for n in ("A", "B")]
        self.autre = Concurrent.objects.create(nom="C", secteur_id=EDTECH)

    def test_cas_normal(self):
        self.assertEqual(secteur_supprime({"secteur_id": FINTECH, "nom": "FinTech"}), "OK (2 concurrent(s) sans secteur)")
        self.assertEqual(Concurrent.objects.filter(secteur_id__isnull=True).count(), 2)
        self.assertEqual(Concurrent.objects.get(id=self.autre.id).secteur_id, EDTECH)

    def test_secteur_sans_concurrent_n_est_pas_une_erreur(self):
        self.assertEqual(secteur_supprime({"secteur_id": 999}), "OK (0 concurrent(s) sans secteur)")

    def test_message_en_double(self):
        message = producteur.construire_message("secteur.supprime", {"secteur_id": FINTECH})
        canal = mock.Mock()
        with mock.patch("concurrents.handlers.Concurrent.objects.filter", wraps=Concurrent.objects.filter) as filtre, \
                self.assertLogs("evenements.consommateur", "INFO") as logs:
            for tag in (1, 2):
                consommateur.traiter(self.QUEUE, secteur_supprime, canal, mock.Mock(delivery_tag=tag), None,
                                     json.dumps(message).encode(), attente=0)
        filtre.assert_called_once()  # le 2e message n'est pas rejoué
        self.assertEqual(canal.basic_ack.call_count, 2)
        self.assertIn("déjà traité", logs.output[1])
