"""
Analyse du marché d'un secteur (reprise de marche/services/analyse.py).

Les concurrents ne sont plus dans la même base : ils sont lus en un appel
GET /api/market/concurrents/?secteur=<id> sur CONCURRENT-SERVICE, puis les
statistiques (moyenne, somme, top 3) sont calculées ici.

Le niveau de concurrence suit la règle commune de market_commun.concurrence
(identique à etude-service) : sans concurrent, il vaut "inconnu" et le prix moyen est null.
"""

from clients import ConcurrentClient
from market_commun.concurrence import (  # noqa: F401 (calculer_niveau_concurrence : réexporté)
    arrondir, calculer_niveau_concurrence, decimal, niveau_des_concurrents, part_cumulee, prix_moyen,
)

from ..models import Secteur, Tendance


def _concurrent_resume(concurrent):
    """Représentation courte d'un concurrent pour les analyses."""
    return {
        "id": concurrent["id"],
        "nom": concurrent["nom"],
        "pays": concurrent["pays"],
        "prix_moyen": arrondir(decimal(concurrent["prix_moyen"])),
        "part_de_marche": arrondir(decimal(concurrent["part_de_marche"])),
    }


def analyser_secteur(secteur: Secteur):
    """Statistiques d'un secteur : concurrents, prix, parts de marché, tendances."""
    concurrents = ConcurrentClient().du_secteur(secteur.id)
    moyenne = prix_moyen(concurrents)

    # Top 3 des concurrents par part de marché
    top3 = sorted(concurrents, key=lambda c: (-decimal(c["part_de_marche"]), c["nom"]))[:3]

    # Comptage des tendances par impact (même service : requêtes locales)
    tendances = Tendance.objects.filter(secteur=secteur)
    nb_positives = tendances.filter(impact=Tendance.Impact.POSITIF).count()
    nb_negatives = tendances.filter(impact=Tendance.Impact.NEGATIF).count()

    return {
        "secteur": {"id": secteur.id, "nom": secteur.nom},
        "nombre_concurrents": len(concurrents),
        # null (et non 0.0) quand le secteur n'a aucun concurrent : pas de prix de marché
        "prix_moyen": arrondir(moyenne) if moyenne is not None else None,
        "part_de_marche_totale": part_cumulee(concurrents),
        "top_concurrents": [_concurrent_resume(c) for c in top3],
        "tendances_positives": nb_positives,
        "tendances_negatives": nb_negatives,
        "niveau_concurrence": niveau_des_concurrents(concurrents),
    }
