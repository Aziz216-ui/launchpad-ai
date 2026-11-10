"""Événements RabbitMQ publiés par User-Service.

accountant.registered : à l'inscription d'un utilisateur ACCOUNTANT, le message est publié dans la
queue durable « workspace.accountant_registered », consommée par workspace-service (espace comptable,
Backend/Professional-Service) qui crée l'espace du comptable, ouvert aux demandes. Le comptable
apparaît ainsi tout de suite dans l'annuaire « Demander un comptable » des entrepreneurs.

- Publication sur l'exchange par défaut, routing key = nom de la queue (comme les autres services
  Symfony). La queue est aussi déclarée ici, avec les mêmes paramètres que le consommateur : un
  message publié avant le premier démarrage de workspace-service n'est pas perdu.
- Message persistant (delivery_mode=2), confirmé par le broker.
- RabbitMQ indisponible : l'erreur est journalisée et l'inscription réussit quand même. La commande
  `python manage.py sync_accountant_workspaces`, lancée à chaque démarrage du conteneur, republie
  tous les comptables (le consommateur est idempotent) et rattrape les messages manqués.
"""

import json
import logging
import os

import pika
from django.utils import timezone

logger = logging.getLogger(__name__)

# Nom partagé avec Launchpad\Common\Messaging\Queues::WORKSPACE_ACCOUNTANT_REGISTERED
ACCOUNTANT_REGISTERED_QUEUE = "workspace.accountant_registered"


def _parametres_connexion():
    identifiants = pika.PlainCredentials(
        os.getenv("RABBITMQ_USER", "guest"), os.getenv("RABBITMQ_PASSWORD", "guest")
    )
    return pika.ConnectionParameters(
        host=os.getenv("RABBITMQ_HOST", "localhost"),
        port=int(os.getenv("RABBITMQ_PORT", "5672")),
        credentials=identifiants,
        connection_attempts=2,
        retry_delay=1,
        socket_timeout=5,
        blocked_connection_timeout=5,
    )


def message_comptable(user):
    """Contenu JSON attendu par AccountantRegistered::fromArray (workspace-service)."""
    nom = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return {
        "accountantId": user.keycloak_id,
        "displayName": nom or user.username or user.email,
        "email": user.email,
        "registeredAt": (user.created_at or timezone.now()).isoformat(),
    }


def publier_comptables(users):
    """Publie un message par comptable sur une seule connexion ; lève une exception en cas d'échec."""
    messages = [message_comptable(u) for u in users if u.keycloak_id]
    if not messages:
        return 0
    connexion = pika.BlockingConnection(_parametres_connexion())
    try:
        canal = connexion.channel()
        canal.confirm_delivery()
        canal.queue_declare(queue=ACCOUNTANT_REGISTERED_QUEUE, durable=True)
        for message in messages:
            canal.basic_publish(
                exchange="",
                routing_key=ACCOUNTANT_REGISTERED_QUEUE,
                body=json.dumps(message, ensure_ascii=False).encode("utf-8"),
                properties=pika.BasicProperties(
                    content_type="application/json",
                    delivery_mode=2,
                    type="accountant.registered",
                    app_id="user-service",
                ),
            )
    finally:
        connexion.close()
    return len(messages)


def publier_comptable_inscrit(user):
    """Publication après inscription : n'interrompt jamais l'inscription (voir docstring du module)."""
    try:
        publier_comptables([user])
        logger.info("[RabbitMQ] accountant.registered publié pour %s", user.username)
    except Exception as exc:  # noqa: BLE001 - l'inscription ne doit pas échouer à cause du broker
        logger.error(
            "[RabbitMQ] accountant.registered non publié pour %s (%s) : rattrapé au prochain "
            "démarrage par sync_accountant_workspaces",
            user.username, exc or type(exc).__name__,
        )
