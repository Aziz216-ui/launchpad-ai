"""
Handlers des événements RabbitMQ consommés par concurrent-service (python manage.py consume_events).

Chaque handler reçoit le champ "data" du message, s'exécute dans une transaction et renvoie
un court compte rendu pour les logs. Rejouer un handler ne change rien (idempotent).
"""

from .models import Concurrent


def secteur_supprime(data):
    """secteur.supprime -> secteur_id = null pour les concurrents du secteur supprimé."""
    nb = Concurrent.objects.filter(secteur_id=data["secteur_id"]).update(secteur_id=None)
    return f"OK ({nb} concurrent(s) sans secteur)"
