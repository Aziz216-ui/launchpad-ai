"""
Handlers des événements RabbitMQ consommés par etude-service (python manage.py consume_events).

Chaque handler reçoit le champ "data" du message, s'exécute dans une transaction et renvoie
un court compte rendu pour les logs. Rejouer un handler ne change rien (idempotent).
"""

from .models import EtudeMarche


def secteur_supprime(data):
    """secteur.supprime -> secteur_id = null pour les études du secteur supprimé."""
    nb = EtudeMarche.objects.filter(secteur_id=data["secteur_id"]).update(secteur_id=None)
    return f"OK ({nb} étude(s) sans secteur)"


def concurrent_supprime(data):
    """concurrent.supprime -> l'id est retiré de concurrent_ids dans toutes les études."""
    concurrent_id = data["concurrent_id"]
    nb = 0
    # Filtre en Python : la recherche dans une liste JSON n'est pas portable (SQLite pour les tests)
    for etude in EtudeMarche.objects.only("id", "concurrent_ids"):
        if concurrent_id in etude.concurrent_ids:
            etude.concurrent_ids = [i for i in etude.concurrent_ids if i != concurrent_id]
            etude.save(update_fields=["concurrent_ids", "date_mise_a_jour"])
            nb += 1
    return f"OK (retiré de {nb} étude(s))"
