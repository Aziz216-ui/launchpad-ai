"""
Commande Django pour consommer les événements RabbitMQ de Projet-Service.
Écoute :
1. L'exchange 'market.events' de l'Étude de marché (collègue).
2. L'exchange 'finance.events' du service Finance (collègue).
Usage : python manage.py consume_events

Garanties conformes au standard du cours :
- Exchanges topic durables : market.events, finance.events
- Queues durables : ai.etude-finalisee, ai.finance-events
- Routing keys : etude.finalisee, finance.#, finance.document.genere
- prefetch_count=1 (distribution équitable)
- Ack manuel après traitement réussi
- Reconnexion automatique toutes les 5s si RabbitMQ redémarre
"""
from __future__ import annotations

import json
import logging
import os
import time

import pika
from django.conf import settings
from django.core.management.base import BaseCommand

from projet.events.handlers import handle_etude_finalisee, handle_finance_document_genere

logger = logging.getLogger(__name__)

MARKET_EXCHANGE_NAME = getattr(settings, "MARKET_RABBITMQ_EXCHANGE", os.getenv("MARKET_RABBITMQ_EXCHANGE", "market.events"))
MARKET_QUEUE_NAME = "ai.etude-finalisee"
MARKET_ROUTING_KEY = "etude.finalisee"

FINANCE_EXCHANGE_NAME = getattr(settings, "FINANCE_RABBITMQ_EXCHANGE", os.getenv("FINANCE_RABBITMQ_EXCHANGE", "finance.events"))
FINANCE_QUEUE_NAME = "ai.finance-events"
FINANCE_ROUTING_KEY = "finance.#"

RABBITMQ_HOST = getattr(settings, "RABBITMQ_HOST", os.getenv("RABBITMQ_HOST", "localhost"))
RABBITMQ_PORT = int(getattr(settings, "RABBITMQ_PORT", os.getenv("RABBITMQ_PORT", "5672")))
RABBITMQ_USER = getattr(settings, "RABBITMQ_USER", os.getenv("RABBITMQ_USER", "market"))
RABBITMQ_PASSWORD = getattr(settings, "RABBITMQ_PASSWORD", os.getenv("RABBITMQ_PASSWORD", "market"))


class Command(BaseCommand):
    help = "Consomme les événements 'market.events' et 'finance.events' pour Projet-Service"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(
            f"[RABBITMQ] Démarrage du consumer Projet-Service sur '{MARKET_QUEUE_NAME}' et '{FINANCE_QUEUE_NAME}'..."
        ))

        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials,
            heartbeat=60,
        )

        while True:
            try:
                self.stdout.write(f"Connexion au broker RabbitMQ ({RABBITMQ_HOST}:{RABBITMQ_PORT})...")
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()

                # prefetch_count=1 : un seul message traité à la fois
                channel.basic_qos(prefetch_count=1)

                # 1. Configuration Market (Étude de marché)
                channel.exchange_declare(
                    exchange=MARKET_EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )
                channel.queue_declare(
                    queue=MARKET_QUEUE_NAME,
                    durable=True,
                )
                channel.queue_bind(
                    exchange=MARKET_EXCHANGE_NAME,
                    queue=MARKET_QUEUE_NAME,
                    routing_key=MARKET_ROUTING_KEY,
                )

                # 2. Configuration Finance (Document-Service)
                channel.exchange_declare(
                    exchange=FINANCE_EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )
                channel.queue_declare(
                    queue=FINANCE_QUEUE_NAME,
                    durable=True,
                )
                channel.queue_bind(
                    exchange=FINANCE_EXCHANGE_NAME,
                    queue=FINANCE_QUEUE_NAME,
                    routing_key=FINANCE_ROUTING_KEY,
                )
                channel.queue_bind(
                    exchange=FINANCE_EXCHANGE_NAME,
                    queue=FINANCE_QUEUE_NAME,
                    routing_key="finance.document.genere",
                )

                def on_market_message(ch, method, properties, body):
                    try:
                        payload = json.loads(body.decode("utf-8"))
                        event = payload.get("event")
                        message_id = payload.get("message_id")
                        data = payload.get("data", {})

                        self.stdout.write(self.style.NOTICE(
                            f"[CONSUMER MARKET] Message reçu sur '{MARKET_QUEUE_NAME}' : event={event} id={message_id}"
                        ))

                        if event == "etude.finalisee":
                            handle_etude_finalisee(data)

                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self.stdout.write(self.style.SUCCESS(
                            f"[CONSUMER MARKET] {MARKET_QUEUE_NAME} event={event} -> ACK OK"
                        ))

                    except Exception as err:
                        self.stderr.write(self.style.ERROR(
                            f"[CONSUMER MARKET ERROR] Erreur lors du traitement : {err}"
                        ))
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                def on_finance_message(ch, method, properties, body):
                    # finance.# reçoit aussi les événements du suivi des prévisions
                    # (finance.prevision.a-valider, finance.prevision.avis) : seuls les documents
                    # générés concernent ce service, les autres messages sont acquittés et ignorés.
                    if method.routing_key != "finance.document.genere":
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self.stdout.write(
                            f"[CONSUMER FINANCE] Clé '{method.routing_key}' ignorée -> ACK"
                        )
                        return
                    try:
                        payload = json.loads(body.decode("utf-8"))
                        self.stdout.write(self.style.NOTICE(
                            f"[CONSUMER FINANCE] Message reçu sur '{FINANCE_QUEUE_NAME}' : {payload}"
                        ))

                        # Traitement direct du document financier
                        handle_finance_document_genere(payload)

                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self.stdout.write(self.style.SUCCESS(
                            f"[CONSUMER FINANCE] Document financier traité avec succès -> ACK OK"
                        ))

                    except Exception as err:
                        self.stderr.write(self.style.ERROR(
                            f"[CONSUMER FINANCE ERROR] Erreur lors du traitement finance : {err}"
                        ))
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                channel.basic_consume(
                    queue=MARKET_QUEUE_NAME,
                    on_message_callback=on_market_message,
                    auto_ack=False,
                )
                channel.basic_consume(
                    queue=FINANCE_QUEUE_NAME,
                    on_message_callback=on_finance_message,
                    auto_ack=False,
                )

                self.stdout.write(self.style.SUCCESS(
                    f"[RABBITMQ] En attente d'événements sur :\n"
                    f" - '{MARKET_QUEUE_NAME}' (Exchange: '{MARKET_EXCHANGE_NAME}')\n"
                    f" - '{FINANCE_QUEUE_NAME}' (Exchange: '{FINANCE_EXCHANGE_NAME}')"
                ))
                self.stdout.write("Appuyez sur Ctrl+C pour arrêter.")
                channel.start_consuming()

            except pika.exceptions.AMQPConnectionError as exc:
                self.stderr.write(self.style.WARNING(
                    f"Broker RabbitMQ indisponible ({exc}). Nouvelle tentative dans 5 secondes..."
                ))
                time.sleep(5)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("\nArrêt du consumer demandé par l'utilisateur."))
                break
            except Exception as exc:
                self.stderr.write(self.style.ERROR(
                    f"Erreur inattendue : {exc}. Redémarrage dans 5 secondes..."
                ))
                time.sleep(5)
