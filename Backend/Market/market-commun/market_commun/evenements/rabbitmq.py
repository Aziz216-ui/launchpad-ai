"""Connexion à RabbitMQ et déclaration de la topologie commune (idempotente)."""

import pika
from django.conf import settings

# Exchange de type topic sur lequel TOUS les producers publient (jamais directement dans une queue)
EXCHANGE = "market.events"
# Dead-letter : un message en échec après 3 tentatives est rejeté vers market.dlx -> market.dlq
DLX = "market.dlx"
DLQ = "market.dlq"


def parametres(heartbeat=None):
    """Paramètres de connexion lus dans les variables RABBITMQ_* (voir .env.example)."""
    return pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD),
        heartbeat=heartbeat,
        connection_attempts=1,
        socket_timeout=3,
        blocked_connection_timeout=5,
    )


def connecter(heartbeat=None):
    return pika.BlockingConnection(parametres(heartbeat))


def declarer_topologie(canal):
    """Exchange topic durable + dead-letter exchange et queue (market.dlq)."""
    canal.exchange_declare(EXCHANGE, exchange_type="topic", durable=True)
    canal.exchange_declare(DLX, exchange_type="fanout", durable=True)
    canal.queue_declare(DLQ, durable=True)
    canal.queue_bind(DLQ, DLX)


def declarer_queue(canal, queue, routing_key):
    """Queue durable liée à l'exchange ; les messages rejetés partent vers la DLQ."""
    canal.queue_declare(queue, durable=True, arguments={"x-dead-letter-exchange": DLX})
    canal.queue_bind(queue, EXCHANGE, routing_key)
