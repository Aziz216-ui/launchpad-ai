"""
Handlers des événements RabbitMQ consommés par swot-service (python manage.py consume_events).

Chaque handler reçoit le champ "data" du message, s'exécute dans une transaction et renvoie
un court compte rendu pour les logs. Rejouer un handler ne change rien (idempotent).
"""

from clients import RessourceIntrouvable

from .models import ElementSWOT
from .services import generer_swot


def etude_finalisee(data):
    """
    etude.finalisee -> génère la SWOT automatique (les éléments saisis à la main sont conservés).

    Les données de l'étude sont lues sur ETUDE-SERVICE (appel synchrone via Eureka). Étude
    supprimée entre-temps : rien à générer, ce n'est pas une erreur. ETUDE-SERVICE injoignable :
    l'exception remonte, le consumer réessaie puis envoie le message dans market.dlq.
    """
    try:
        generes = generer_swot(data["etude_id"])
    except RessourceIntrouvable:
        return "ignoré (étude introuvable)"
    return f"OK ({generes} élément(s) généré(s))"


def etude_supprimee(data):
    """etude.supprimee -> supprime tous les éléments SWOT de l'étude (manuels et générés)."""
    nb, _ = ElementSWOT.objects.filter(etude_id=data["etude_id"]).delete()
    return f"OK ({nb} élément(s) supprimé(s))"
