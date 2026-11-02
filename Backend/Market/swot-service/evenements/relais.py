"""
Relais de l'outbox : renvoie les événements non publiés, toutes les 10 s.

Démarré dans un thread du processus serveur (EvenementsConfig.ready), comme
l'enregistrement Eureka : jamais pendant migrate, test, consume_events...
"""

import logging
import threading
import time

from django.db import close_old_connections
from django.utils import timezone

from . import producteur
from .models import EvenementOutbox

logger = logging.getLogger(__name__)

INTERVALLE = 10  # secondes entre deux tentatives
_demarre = False


def renvoyer_en_attente(limite=100):
    """Renvoie les événements en attente, dans l'ordre ; s'arrête au premier échec. Renvoie le nombre envoyé."""
    envoyes = 0
    for evenement in EvenementOutbox.objects.filter(date_envoi__isnull=True)[:limite]:
        try:
            producteur.envoyer(evenement.message)
        except Exception as exc:
            evenement.tentatives += 1
            evenement.derniere_erreur = str(exc) or type(exc).__name__
            evenement.save(update_fields=["tentatives", "derniere_erreur"])
            break  # RabbitMQ toujours indisponible : on réessaiera au prochain tour
        evenement.tentatives += 1
        evenement.date_envoi = timezone.now()
        evenement.save(update_fields=["tentatives", "date_envoi"])
        envoyes += 1
        logger.info("[PRODUCER] %s %s (outbox, %d tentative(s))", evenement.routing_key,
                    producteur.resume(evenement.message["data"]), evenement.tentatives)
    return envoyes


def _boucle():
    while True:
        time.sleep(INTERVALLE)
        try:
            close_old_connections()
            renvoyer_en_attente()
        except Exception as exc:  # base indisponible... : le relais ne doit jamais s'arrêter
            logger.warning("Relais de l'outbox : %s", exc)
        finally:
            close_old_connections()


def demarrer():
    """Lance le relais une seule fois par processus (thread démon)."""
    global _demarre
    if _demarre:
        return
    _demarre = True
    threading.Thread(target=_boucle, name="relais-outbox", daemon=True).start()
    logger.info("Relais de l'outbox démarré (toutes les %d s).", INTERVALLE)
