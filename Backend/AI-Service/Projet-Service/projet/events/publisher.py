"""
Producteur d'événements RabbitMQ pour Projet-Service.
Modèle du cours : Producer -> Exchange (type topic, durable) -> Queue -> Consumer.

Format du message conforme au standard LaunchPad AI :
{
    "message_id": "<uuid>",
    "event": "<nom.evenement>",
    "occurred_at": "<iso-timestamp>",
    "source": "projet-service",
    "data": { ... }
}
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone

import pika

logger = logging.getLogger(__name__)

EXCHANGE_NAME = os.getenv("RABBITMQ_EXCHANGE", "ai.events")
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")


def _get_connection():
    """Crée une connexion pika avec un timeout court pour rester non-bloquant."""
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    parameters = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=1,
        socket_timeout=2.0,
    )
    return pika.BlockingConnection(parameters)


def publier_evenement(event: str, data: dict, source: str = "projet-service") -> bool:
    """
    Publie un message persistant (delivery_mode=2) sur l'exchange topic.
    Ne lève jamais d'exception non gérée : si RabbitMQ est éteint, log un warning.
    """
    message_id = str(uuid.uuid4())
    message = {
        "message_id": message_id,
        "event": event,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "data": data,
    }

    try:
        connection = _get_connection()
        channel = connection.channel()

        # Déclaration de l'exchange (topic, durable=True comme spécifié dans le cours)
        channel.exchange_declare(
            exchange=EXCHANGE_NAME,
            exchange_type="topic",
            durable=True,
        )

        body = json.dumps(message).encode("utf-8")
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=event,
            body=body,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Rendre le message persistant sur disque
                content_type="application/json",
                message_id=message_id,
            ),
        )

        connection.close()
        logger.info(
            "[PRODUCER] %s message_id=%s projet_id=%s -> OK (publié sur '%s')",
            event, message_id, data.get("projet_id"), EXCHANGE_NAME,
        )
        return True

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[PRODUCER] Impossible de publier l'événement '%s' sur RabbitMQ (%s). "
            "L'action HTTP réussit quand même.",
            event, exc,
        )
        return False

