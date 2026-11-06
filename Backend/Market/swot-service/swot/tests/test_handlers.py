"""Tests des handlers RabbitMQ du swot-service (appelés directement, ETUDE-SERVICE mocké)."""

import json
from unittest import mock

from rest_framework.test import APITestCase

from clients import ServiceIndisponible
from market_commun.evenements import consommateur, producteur
from market_commun.evenements.models import MessageTraite
from swot.handlers import etude_finalisee, etude_supprimee
from swot.models import ElementSWOT

from .test_api import AUTRE_ETUDE, ETUDE, EtudeServiceMockeMixin


class EtudeFinaliseeTests(EtudeServiceMockeMixin, APITestCase):
    """Queue swot.etude-finalisee."""

    def test_cas_normal_genere_la_swot_et_garde_les_elements_manuels(self):
        manuel = ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="Équipe")
        compte_rendu = etude_finalisee({"etude_id": ETUDE, "projet_id": 1})
        generes = ElementSWOT.objects.filter(etude_id=ETUDE, genere_automatiquement=True).count()
        self.assertGreater(generes, 0)
        self.assertEqual(compte_rendu, f"OK ({generes} élément(s) généré(s))")
        self.assertTrue(ElementSWOT.objects.filter(id=manuel.id).exists())

    def test_etude_absente_n_est_pas_une_erreur(self):
        self.assertEqual(etude_finalisee({"etude_id": 9999}), "ignoré (étude introuvable)")
        self.assertFalse(ElementSWOT.objects.exists())

    def test_message_en_double_ne_regenere_pas(self):
        message = producteur.construire_message("etude.finalisee", {"etude_id": ETUDE})
        canal = mock.Mock()
        with self.assertLogs("market_commun.evenements.consommateur", "INFO") as logs:
            for tag in (1, 2):
                consommateur.traiter("swot.etude-finalisee", etude_finalisee, canal, mock.Mock(delivery_tag=tag),
                                     None, json.dumps(message).encode(), attente=0)
        self.assertEqual(self.comparaison_prix.call_count, 1)
        self.assertEqual(canal.basic_ack.call_count, 2)
        self.assertIn(f"[CONSUMER] swot.etude-finalisee etude_id={ETUDE} -> OK", logs.output[0])
        self.assertIn("déjà traité", logs.output[1])

    def test_etude_service_indisponible_trois_tentatives_puis_dlq(self):
        self.get.side_effect = ServiceIndisponible("ETUDE-SERVICE")
        message = producteur.construire_message("etude.finalisee", {"etude_id": ETUDE})
        canal = mock.Mock()
        with self.assertLogs("market_commun.evenements.consommateur", "WARNING"):
            consommateur.traiter("swot.etude-finalisee", etude_finalisee, canal, mock.Mock(delivery_tag=1),
                                 None, json.dumps(message).encode(), attente=0)
        self.assertEqual(self.get.call_count, 3)
        canal.basic_nack.assert_called_once_with(delivery_tag=1, requeue=False)
        self.assertFalse(MessageTraite.objects.exists())


class EtudeSupprimeeTests(APITestCase):
    """Queue swot.etude-supprimee."""

    def setUp(self):
        ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="Manuel")
        ElementSWOT.objects.create(etude_id=ETUDE, type="menace", description="Auto", genere_automatiquement=True)
        ElementSWOT.objects.create(etude_id=AUTRE_ETUDE, type="force", description="Autre étude")

    def test_cas_normal(self):
        self.assertEqual(etude_supprimee({"etude_id": ETUDE}), "OK (2 élément(s) supprimé(s))")
        self.assertEqual(list(ElementSWOT.objects.values_list("etude_id", flat=True)), [AUTRE_ETUDE])

    def test_swot_deja_supprimee_n_est_pas_une_erreur(self):
        etude_supprimee({"etude_id": ETUDE})
        self.assertEqual(etude_supprimee({"etude_id": ETUDE}), "OK (0 élément(s) supprimé(s))")

    def test_message_en_double(self):
        message = producteur.construire_message("etude.supprimee", {"etude_id": ETUDE})
        canal = mock.Mock()
        with self.assertLogs("market_commun.evenements.consommateur", "INFO") as logs:
            for tag in (1, 2):
                consommateur.traiter("swot.etude-supprimee", etude_supprimee, canal, mock.Mock(delivery_tag=tag),
                                     None, json.dumps(message).encode(), attente=0)
        self.assertIn("-> OK (2 élément(s) supprimé(s))", logs.output[0])
        self.assertIn("déjà traité", logs.output[1])
        self.assertEqual(MessageTraite.objects.count(), 1)
