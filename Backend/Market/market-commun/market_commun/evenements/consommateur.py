"""
Consumer : réception des événements d'une ou plusieurs queues.

- Queues durables liées à l'exchange market.events, prefetch_count=1.
- Ack manuel, envoyé APRÈS le traitement réussi (et son commit en base).
- Idempotence : un message_id déjà traité pour cette queue est acquitté sans être rejoué.
- Erreur de traitement : 3 tentatives, puis rejet (nack sans remise en queue) : RabbitMQ le
  route vers la dead-letter queue market.dlq au lieu de le perdre.
- Reconnexion automatique (toutes les 5 s) si RabbitMQ redémarre.

Un handler reçoit le champ "data" du message et renvoie un court compte rendu ("OK", ...).
"""

import functools
import json
import logging
import time

import pika.exceptions
from django.db import close_old_connections, connection, transaction
from django.utils.module_loading import import_string

from . import rabbitmq
from .models import MessageTraite
from .producteur import resume

logger = logging.getLogger(__name__)

TENTATIVES = 3
ATTENTE_RECONNEXION = 5  # secondes
DEJA_TRAITE = "déjà traité, ignoré"


def rafraichir_connexion():
    """Processus de longue durée : ferme la connexion à la base si elle est cassée (hors transaction)."""
    if not connection.in_atomic_block:
        close_old_connections()


def appliquer(queue, handler, message):
    """Traite un message une seule fois (idempotence par message_id) ; renvoie le compte rendu."""
    rafraichir_connexion()
    if MessageTraite.objects.filter(message_id=message["message_id"], queue=queue).exists():
        return DEJA_TRAITE
    with transaction.atomic():  # effet du message et trace "traité" enregistrés ensemble
        compte_rendu = handler(message["data"]) or "OK"
        MessageTraite.objects.create(message_id=message["message_id"], queue=queue, event=message["event"])
    return compte_rendu


def traiter(queue, handler, canal, livraison, proprietes, corps, attente=1.0):
    """Callback pika : traitement, puis ack ; après 3 échecs, nack -> dead-letter queue."""
    try:
        message = json.loads(corps)
        donnees = resume(message["data"])
    except (ValueError, KeyError, TypeError, AttributeError) as exc:
        logger.exception("[CONSUMER] %s message illisible (%s) -> DLQ %s", queue, exc, rabbitmq.DLQ)
        canal.basic_nack(delivery_tag=livraison.delivery_tag, requeue=False)
        return

    for tentative in range(1, TENTATIVES + 1):
        try:
            compte_rendu = appliquer(queue, handler, message)
        except Exception as exc:
            logger.warning("[CONSUMER] %s %s -> échec (tentative %d/%d) : %s: %s", queue, donnees,
                           tentative, TENTATIVES, type(exc).__name__, exc)
            rafraichir_connexion()
            if tentative < TENTATIVES:
                time.sleep(attente * tentative)
            continue
        canal.basic_ack(delivery_tag=livraison.delivery_tag)
        logger.info("[CONSUMER] %s %s -> %s", queue, donnees, compte_rendu)
        return

    canal.basic_nack(delivery_tag=livraison.delivery_tag, requeue=False)
    logger.error("[CONSUMER] %s %s -> ÉCHEC après %d tentatives, message envoyé dans %s",
                 queue, donnees, TENTATIVES, rabbitmq.DLQ)


def abonnements(configuration):
    """[(queue, routing_key, handler)] à partir de settings.EVENEMENTS_CONSOMMES."""
    return [(queue, routing_key, import_string(chemin)) for queue, (routing_key, chemin) in configuration.items()]


def consommer(configuration, arret=lambda: False):
    """Boucle principale : connexion, déclaration des queues, consommation ; reconnexion si besoin."""
    liste = abonnements(configuration)
    while not arret():
        try:
            connexion = rabbitmq.connecter(heartbeat=30)
            canal = connexion.channel()
            rabbitmq.declarer_topologie(canal)
            canal.basic_qos(prefetch_count=1)  # un seul message non acquitté à la fois
            for queue, routing_key, handler in liste:
                rabbitmq.declarer_queue(canal, queue, routing_key)
                canal.basic_consume(queue, functools.partial(traiter, queue, handler), auto_ack=False)
            logger.info("[CONSUMER] connecté à RabbitMQ, en attente sur : %s",
                        ", ".join(f"{q} ({rk})" for q, rk, _ in liste))
            canal.start_consuming()
        except pika.exceptions.AMQPError as exc:
            logger.warning("[CONSUMER] RabbitMQ indisponible (%s), nouvelle connexion dans %d s",
                           type(exc).__name__, ATTENTE_RECONNEXION)
            time.sleep(ATTENTE_RECONNEXION)
