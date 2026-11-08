"""Tests de la messagerie RabbitMQ (producer, outbox, consumer), sans broker réel."""

import json
import uuid
from unittest import mock

from django.test import TestCase

from market_commun.evenements import consommateur, producteur, rabbitmq, relais
from market_commun.evenements.models import EvenementOutbox, MessageTraite


class ProducteurTests(TestCase):
    def test_format_du_message(self):
        message = producteur.construire_message("objet.cree", {"objet_id": 4})
        self.assertEqual(set(message), {"message_id", "event", "occurred_at", "source", "data"})
        self.assertEqual(message["event"], "objet.cree")
        self.assertEqual(message["data"], {"objet_id": 4})
        uuid.UUID(message["message_id"])  # identifiant unique valide

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_publication_apres_le_commit_seulement(self, envoyer):
        with self.captureOnCommitCallbacks(execute=False) as rappels:
            producteur.publier("objet.cree", {"objet_id": 4})
        envoyer.assert_not_called()  # rien n'est publié avant le commit
        with self.assertLogs("market_commun.evenements.producteur", "INFO") as logs:
            rappels[0]()
        envoyer.assert_called_once()
        self.assertIn("[PRODUCER] objet.cree objet_id=4", logs.output[0])

    def test_message_persistant_sur_l_exchange(self):
        canal = mock.Mock()
        connexion = mock.Mock(**{"channel.return_value": canal})
        with mock.patch("market_commun.evenements.rabbitmq.connecter", return_value=connexion):
            producteur.envoyer(producteur.construire_message("objet.cree", {"objet_id": 4}))
        options = canal.basic_publish.call_args.kwargs
        self.assertEqual(options["exchange"], "market.events")  # jamais directement dans une queue
        self.assertEqual(options["routing_key"], "objet.cree")
        self.assertEqual(options["properties"].delivery_mode, 2)
        self.assertEqual(json.loads(options["body"])["data"], {"objet_id": 4})
        canal.confirm_delivery.assert_called_once()
        connexion.close.assert_called_once()

    @mock.patch("market_commun.evenements.producteur.envoyer", side_effect=ConnectionError("refus"))
    def test_rabbitmq_indisponible_evenement_dans_l_outbox(self, envoyer):
        with self.assertLogs("market_commun.evenements.producteur", "ERROR") as logs, \
                self.captureOnCommitCallbacks(execute=True):
            message = producteur.publier("objet.supprime", {"objet_id": 7})
        self.assertIn("outbox", logs.output[0])
        evenement = EvenementOutbox.objects.get()
        self.assertEqual(str(evenement.message_id), message["message_id"])
        self.assertEqual(evenement.routing_key, "objet.supprime")
        self.assertIsNone(evenement.date_envoi)


class RelaisTests(TestCase):
    def stocker(self, numero):
        message = producteur.construire_message("objet.supprime", {"objet_id": numero})
        return EvenementOutbox.objects.create(message_id=message["message_id"], routing_key=message["event"],
                                              message=message)

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_renvoi_dans_l_ordre(self, envoyer):
        premier = self.stocker(1)
        self.stocker(2)
        with self.assertLogs("market_commun.evenements.relais", "INFO"):
            self.assertEqual(relais.renvoyer_en_attente(), 2)
        self.assertEqual([c.args[0]["data"]["objet_id"] for c in envoyer.call_args_list], [1, 2])
        premier.refresh_from_db()
        self.assertIsNotNone(premier.date_envoi)
        # Déjà envoyés : plus rien à renvoyer
        self.assertEqual(relais.renvoyer_en_attente(), 0)

    @mock.patch("market_commun.evenements.producteur.envoyer", side_effect=ConnectionError("toujours en panne"))
    def test_toujours_indisponible(self, envoyer):
        evenement = self.stocker(1)
        self.stocker(2)
        self.assertEqual(relais.renvoyer_en_attente(), 0)
        envoyer.assert_called_once()  # arrêt au premier échec
        evenement.refresh_from_db()
        self.assertEqual(evenement.tentatives, 1)
        self.assertIsNone(evenement.date_envoi)


class ConsommateurTests(TestCase):
    QUEUE = "test.objet-supprime"

    def setUp(self):
        self.canal = mock.Mock()
        self.livraison = mock.Mock(delivery_tag=42)
        self.message = producteur.construire_message("objet.supprime", {"objet_id": 4})

    def recevoir(self, handler, corps=None):
        corps = json.dumps(self.message).encode() if corps is None else corps
        consommateur.traiter(self.QUEUE, handler, self.canal, self.livraison, None, corps, attente=0)

    def test_traitement_puis_ack(self):
        handler = mock.Mock(return_value="OK")
        with self.assertLogs("market_commun.evenements.consommateur", "INFO") as logs:
            self.recevoir(handler)
        handler.assert_called_once_with({"objet_id": 4})
        self.canal.basic_ack.assert_called_once_with(delivery_tag=42)
        self.assertIn(f"[CONSUMER] {self.QUEUE} objet_id=4 -> OK", logs.output[0])
        self.assertTrue(MessageTraite.objects.filter(message_id=self.message["message_id"]).exists())

    def test_message_en_double_ignore(self):
        handler = mock.Mock(return_value="OK")
        with self.assertLogs("market_commun.evenements.consommateur", "INFO") as logs:
            self.recevoir(handler)
            self.recevoir(handler)
        handler.assert_called_once()  # pas rejoué
        self.assertEqual(self.canal.basic_ack.call_count, 2)
        self.assertIn(consommateur.DEJA_TRAITE, logs.output[1])

    def test_trois_tentatives_puis_dead_letter_queue(self):
        handler = mock.Mock(side_effect=RuntimeError("base indisponible"))
        with self.assertLogs("market_commun.evenements.consommateur", "WARNING") as logs:
            self.recevoir(handler)
        self.assertEqual(handler.call_count, 3)
        self.canal.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)
        self.canal.basic_ack.assert_not_called()
        self.assertIn("market.dlq", logs.output[-1])
        self.assertFalse(MessageTraite.objects.exists())  # rien n'est marqué traité

    def test_reussite_a_la_deuxieme_tentative(self):
        handler = mock.Mock(side_effect=[RuntimeError("temporaire"), "OK"])
        with self.assertLogs("market_commun.evenements.consommateur", "INFO"):
            self.recevoir(handler)
        self.canal.basic_ack.assert_called_once_with(delivery_tag=42)

    def test_message_illisible_directement_en_dlq(self):
        handler = mock.Mock()
        with self.assertLogs("market_commun.evenements.consommateur", "ERROR"):
            self.recevoir(handler, corps=b"pas du json")
        handler.assert_not_called()
        self.canal.basic_nack.assert_called_once_with(delivery_tag=42, requeue=False)

    def test_queue_durable_avec_dead_letter(self):
        canal = mock.Mock()
        rabbitmq.declarer_topologie(canal)
        rabbitmq.declarer_queue(canal, self.QUEUE, "objet.supprime")
        canal.exchange_declare.assert_any_call("market.events", exchange_type="topic", durable=True)
        canal.queue_declare.assert_any_call("market.dlq", durable=True)
        canal.queue_declare.assert_any_call(self.QUEUE, durable=True,
                                            arguments={"x-dead-letter-exchange": "market.dlx"})
        canal.queue_bind.assert_any_call(self.QUEUE, "market.events", "objet.supprime")
