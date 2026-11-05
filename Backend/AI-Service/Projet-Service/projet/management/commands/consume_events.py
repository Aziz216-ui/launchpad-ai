"""
Commande Django pour consommer les événements RabbitMQ de Projet-Service.
Écoute l'exchange 'market.events' de l'Étude de marché (collègue).
Usage : python manage.py consume_events

Garanties conformes au standard du cours :
- Exchange topic durable : market.events
- Queue durable : ai.etude-finalisee
- Routing key : etude.finalisee
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

from projet.events.handlers import handle_etude_finalisee

logger = logging.getLogger(__name__)

EXCHANGE_NAME = getattr(settings, "MARKET_RABBITMQ_EXCHANGE", os.getenv("MARKET_RABBITMQ_EXCHANGE", "market.events"))
QUEUE_NAME = "ai.etude-finalisee"
ROUTING_KEY = "etude.finalisee"

RABBITMQ_HOST = getattr(settings, "RABBITMQ_HOST", os.getenv("RABBITMQ_HOST", "localhost"))
RABBITMQ_PORT = int(getattr(settings, "RABBITMQ_PORT", os.getenv("RABBITMQ_PORT", "5672")))
RABBITMQ_USER = getattr(settings, "RABBITMQ_USER", os.getenv("RABBITMQ_USER", "market"))
RABBITMQ_PASSWORD = getattr(settings, "RABBITMQ_PASSWORD", os.getenv("RABBITMQ_PASSWORD", "market"))


class Command(BaseCommand):
    help = "Consomme les événements 'etude.finalisee' de l'Étude de marché pour Projet-Service"

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS(
            f"[RABBITMQ] Démarrage du consumer Projet-Service sur la queue '{QUEUE_NAME}'..."
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

                # Déclaration de l'Exchange du service Étude de marché (topic, durable)
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
                            f"[CONSUMER] Message reçu sur '{QUEUE_NAME}' : event={event} id={message_id}"
                        ))

                        if event == "etude.finalisee":
                            handle_etude_finalisee(data)

                        # Acquittement manuel (ack) uniquement après exécution réussie
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self.stdout.write(self.style.SUCCESS(
                            f"[CONSUMER] {QUEUE_NAME} {event} message_id={message_id} -> ACK OK"
                        ))

                    except Exception as err:
                        self.stderr.write(self.style.ERROR(
                            f"[CONSUMER ERROR] Erreur lors du traitement de l'événement : {err}"
                        ))
                        # En cas d'erreur bloquante, nack sans requeue
                        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

                channel.basic_consume(
                    queue=QUEUE_NAME,
                    on_message_callback=on_message_callback,
                    auto_ack=False,
                )

                self.stdout.write(self.style.SUCCESS(
                    f"[RABBITMQ] En attente de messages sur '{QUEUE_NAME}' (Exchange: '{EXCHANGE_NAME}', Key: '{ROUTING_KEY}')..."
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

