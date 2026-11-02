"""Tests des handlers RabbitMQ de l'etude-service (appelés directement, sans broker)."""

import json
from unittest import mock

from django.test import TestCase

from etudes.handlers import concurrent_supprime, secteur_supprime
from etudes.models import EtudeMarche
from evenements import consommateur, producteur


class SecteurSupprimeTests(TestCase):
    """Queue etude.secteur-supprime."""

    def setUp(self):
        self.liee = EtudeMarche.objects.create(projet_id=1, secteur_id=1, titre="FinTech")
        self.autre = EtudeMarche.objects.create(projet_id=1, secteur_id=2, titre="EdTech")

    def test_cas_normal(self):
        self.assertEqual(secteur_supprime({"secteur_id": 1, "nom": "FinTech"}), "OK (1 étude(s) sans secteur)")
        self.liee.refresh_from_db()
        self.autre.refresh_from_db()
        self.assertIsNone(self.liee.secteur_id)
        self.assertEqual(self.autre.secteur_id, 2)

    def test_secteur_sans_etude_n_est_pas_une_erreur(self):
        self.assertEqual(secteur_supprime({"secteur_id": 999}), "OK (0 étude(s) sans secteur)")

    def test_message_en_double(self):
        message = producteur.construire_message("secteur.supprime", {"secteur_id": 1})
        canal = mock.Mock()
        handler = mock.Mock(wraps=secteur_supprime)
        with self.assertLogs("evenements.consommateur", "INFO"):
            for tag in (1, 2):
                consommateur.traiter("etude.secteur-supprime", handler, canal, mock.Mock(delivery_tag=tag), None,
                                     json.dumps(message).encode(), attente=0)
        handler.assert_called_once()
        self.assertEqual(canal.basic_ack.call_count, 2)


class ConcurrentSupprimeTests(TestCase):
    """Queue etude.concurrent-supprime."""

    def setUp(self):
        self.e1 = EtudeMarche.objects.create(projet_id=1, secteur_id=1, titre="A", concurrent_ids=[5, 7, 9])
        self.e2 = EtudeMarche.objects.create(projet_id=2, secteur_id=1, titre="B", concurrent_ids=[7])
        self.e3 = EtudeMarche.objects.create(projet_id=3, secteur_id=1, titre="C", concurrent_ids=[5])

    def test_cas_normal(self):
        self.assertEqual(concurrent_supprime({"concurrent_id": 7, "secteur_id": 1}), "OK (retiré de 2 étude(s))")
        for etude, attendu in [(self.e1, [5, 9]), (self.e2, []), (self.e3, [5])]:
            etude.refresh_from_db()
            self.assertEqual(etude.concurrent_ids, attendu)

    def test_concurrent_deja_retire_n_est_pas_une_erreur(self):
        concurrent_supprime({"concurrent_id": 7})
        self.assertEqual(concurrent_supprime({"concurrent_id": 7}), "OK (retiré de 0 étude(s))")
