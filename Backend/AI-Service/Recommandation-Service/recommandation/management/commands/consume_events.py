"""
Commande Django pour consommer les événements RabbitMQ de Recommandation-Service.
Usage : python manage.py consume_events

Garanties conformes au cours :
- Queue durable : recommandation.diagnostic-termine
- Exchange topic durable : ai.events
- Binding routing key : diagnostic.termine
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
from django.core.management.base import BaseCommand

from recommandation.events.handlers import handle_diagnostic_termine

logger = logging.getLogger(__name__)

EXCHANGE_NAME = os.getenv("RABBITMQ_EXCHANGE", "ai.events")
QUEUE_NAME = "recommandation.diagnostic-termine"
ROUTING_KEY = "diagnostic.termine"

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")


class Command(BaseCommand):
    help = "Consomme les événements asynchrones RabbitMQ pour Recommandation-Service"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(
            f"[RABBITMQ] Démarrage du consumer Recommandation-Service sur '{QUEUE_NAME}'..."
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

                # Déclaration de l'Exchange (topic, durable)
                channel.exchange_declare(
                    exchange=EXCHANGE_NAME,
                    exchange_type="topic",
                    durable=True,
                )

                # Déclaration de la Queue durable
                channel.queue_declare(
                    queue=QUEUE_NAME,
                    durable=True,
                )

                # Binding de la Queue sur l'Exchange avec la routing key
                channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=QUEUE_NAME,
                    routing_key=ROUTING_KEY,
                )

                # prefetch_count=1 : un seul message traité à la fois
                channel.basic_qos(prefetch_count=1)

                def on_message_callback(ch, method, properties, body):
                    try:
                        payload = json.loads(body.decode("utf-8"))
                        event = payload.get("event")
                        message_id = payload.get("message_id")
                        data = payload.get("data", {})

                        self.stdout.write(self.style.NOTICE(
                            f"[CONSUMER] Message reçu : event={event} id={message_id}"
                        ))

                        if event == "diagnostic.termine":
                            handle_diagnostic_termine(data)

                        # Acquittement manuel (ack) uniquement après exécution réussie
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self.stdout.write(self.style.SUCCESS(
                            f"[CONSUMER] {QUEUE_NAME} {event} message_id={message_id} -> ACK OK"
                        ))

                    except Exception as err:
                        self.stderr.write(self.style.ERROR(
                            f"[CONSUMER ERROR] Erreur lors du traitement : {err}"
                        ))
                        # En cas d'erreur bloquante, nack sans requeue pour éviter une boucle infinie
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                channel.basic_consume(
                    queue=QUEUE_NAME,
                    on_message_callback=on_message_callback,
                    auto_ack=False,
                )

                self.stdout.write(self.style.SUCCESS(
                    f"[RABBITMQ] En attente de messages sur '{QUEUE_NAME}' (Routing Key: '{ROUTING_KEY}')...\n"
                    "Appuyez sur Ctrl+C pour arrêter."
                ))
                channel.start_consuming()

            except pika.exceptions.AMQPConnectionError as err:
                self.stderr.write(self.style.WARNING(
                    f"[RABBITMQ] Connexion perdue ou impossible ({err}). Nouvelle tentative dans 5 secondes..."
                ))
                time.sleep(5)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING("\nArrêt du consumer demandé par l'utilisateur."))
                break

