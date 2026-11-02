"""
Producer : publication d'un événement sur l'exchange market.events.

publier("etude.finalisee", {"etude_id": 4}) :
1. construit le message JSON {message_id, event, occurred_at, source, data} ;
2. attend le COMMIT de la transaction en cours (transaction.on_commit) : un événement n'est
   jamais publié pour une écriture annulée ;
3. publie sur l'exchange (message persistant, delivery_mode=2, confirmation du broker) ;
4. si RabbitMQ est indisponible : l'erreur est logguée, l'action HTTP réussit quand même et
   l'événement est rangé dans la table outbox, renvoyée automatiquement (relais.py).
"""

import json
import logging
import uuid

import pika
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from . import rabbitmq
from .models import EvenementOutbox

logger = logging.getLogger(__name__)


def resume(data):
    """etude_id=4 secteur_id=1 : données affichées dans les logs."""
    return " ".join(f"{cle}={valeur}" for cle, valeur in data.items() if not isinstance(valeur, (dict, list)))


def construire_message(event, data):
    return {
        "message_id": str(uuid.uuid4()),
        "event": event,
        "occurred_at": timezone.now().isoformat(),
        "source": settings.SERVICE_NAME,
        "data": data,
    }


def envoyer(message):
    """Publie un message sur l'exchange (lève une exception si RabbitMQ ne l'a pas accepté)."""
    connexion = rabbitmq.connecter()
    try:
        canal = connexion.channel()
        canal.confirm_delivery()  # le broker confirme la prise en charge du message
        rabbitmq.declarer_topologie(canal)
        canal.basic_publish(
            exchange=rabbitmq.EXCHANGE,
            routing_key=message["event"],
            body=json.dumps(message, ensure_ascii=False).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,  # message persistant
                message_id=message["message_id"],
                type=message["event"],
                app_id=message["source"],
            ),
            mandatory=False,
        )
    finally:
        connexion.close()


def envoyer_ou_stocker(message):
    """Publication immédiate ; en cas d'échec, l'événement part dans l'outbox."""
    try:
        envoyer(message)
    except Exception as exc:
        logger.error("[PRODUCER] %s %s -> RabbitMQ indisponible (%s), événement mis dans l'outbox",
                     message["event"], resume(message["data"]), exc or type(exc).__name__)
        EvenementOutbox.objects.create(
            message_id=message["message_id"], routing_key=message["event"], message=message,
            derniere_erreur=str(exc) or type(exc).__name__,
        )
        return False
    logger.info("[PRODUCER] %s %s", message["event"], resume(message["data"]))
    return True


def publier(event, data):
    """Publie l'événement après le commit de la transaction en cours ; renvoie le message."""
    message = construire_message(event, data)
    transaction.on_commit(lambda: envoyer_ou_stocker(message))
    return message
