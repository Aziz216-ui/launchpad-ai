"""
Génération de la SWOT d'une étude (reprise de marche/services/etude.py).

Les règles sont inchangées. Les données de l'étude ne sont plus en base locale :
elles sont lues sur ETUDE-SERVICE, qui calcule lui-même la comparaison des prix et
les opportunités/menaces à partir de CONCURRENT-SERVICE et SECTEUR-SERVICE :
- GET /api/market/etudes/<id>/                       (offre, prix proposé, personas)
- GET /api/market/etudes/<id>/comparaison-prix/      (positionnement prix)
- GET /api/market/etudes/<id>/opportunites-menaces/  (facteurs externes)
"""

from decimal import Decimal

from django.db import transaction

from clients import EtudeClient

from ..models import ElementSWOT


def _pourcentage(valeur):
    """Formate un écart en % pour les textes (ex : -20.00 -> "20 %")."""
    return f"{abs(Decimal(str(valeur))).normalize():f} %"


def calculer_elements_swot(etude_id):
    """
    Éléments SWOT déduits par règles simples, sous forme de (type, description).

    Forces / faiblesses : facteurs internes (prix, personas, offre, concurrents étudiés).
    Opportunités / menaces : facteurs externes, repris de evaluer_opportunites_menaces
    (hors positionnement prix, déjà compté en force ou faiblesse).

    Lève RessourceIntrouvable si l'étude n'existe pas, ServiceIndisponible si
    ETUDE-SERVICE (ou un service dont il dépend) ne répond pas.
    """
    client = EtudeClient()
    etude = client.get(etude_id)
    prix = client.comparaison_prix(etude_id)
    externes = client.opportunites_menaces(etude_id)

    T = ElementSWOT.Type
    elements = []

    if prix["positionnement"] == "economique":
        elements.append((T.FORCE, f"Prix proposé inférieur de {_pourcentage(prix['ecart_moyenne_pct'])} "
                                  "à la moyenne des concurrents."))
    elif prix["positionnement"] == "premium":
        elements.append((T.FAIBLESSE, "Prix proposé supérieur à la moyenne des concurrents."))
    elif prix["positionnement"] == "aligne":
        elements.append((T.FORCE, "Prix proposé aligné sur le marché."))
    if etude["prix_propose"] is None:
        elements.append((T.FAIBLESSE, "Offre non chiffrée : aucun prix proposé."))

    nb_personas = len(etude.get("personas", []))
    if nb_personas:
        elements.append((T.FORCE, f"Cible clients définie ({nb_personas} persona(s))."))
    else:
        elements.append((T.FAIBLESSE, "Cible clients non définie : aucun persona."))

    if not (etude.get("description_offre") or "").strip():
        elements.append((T.FAIBLESSE, "Offre non décrite."))
    if not prix["nombre_concurrents"]:
        elements.append((T.FAIBLESSE, "Concurrence non étudiée : aucun concurrent identifié."))

    for element in externes["opportunites"]:
        if element["source"] != "prix":
            elements.append((T.OPPORTUNITE, element["description"]))
    for element in externes["menaces"]:
        if element["source"] != "prix":
            elements.append((T.MENACE, element["description"]))

    return elements


def generer_swot(etude_id):
    """
    (Re)génère les éléments SWOT automatiques de l'étude.

    Seuls les éléments générés automatiquement sont remplacés :
    ceux saisis à la main sont conservés. Renvoie le nombre d'éléments générés.
    Les appels REST sont faits avant la transaction (aucune écriture si un service manque).
    """
    calcules = calculer_elements_swot(etude_id)
    with transaction.atomic():
        ElementSWOT.objects.filter(etude_id=etude_id, genere_automatiquement=True).delete()
        ElementSWOT.objects.bulk_create([
            ElementSWOT(etude_id=etude_id, type=type_, description=description, genere_automatiquement=True)
            for type_, description in calcules
        ])
    return len(calcules)
