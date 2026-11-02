"""
Analyse du marché d'un secteur (reprise de marche/services/analyse.py).

Les concurrents ne sont plus dans la même base : ils sont lus en un appel
GET /api/market/concurrents/?secteur=<id> sur CONCURRENT-SERVICE, puis les
statistiques (moyenne, somme, top 3) sont calculées ici.
"""

from decimal import Decimal

from clients import ConcurrentClient

from ..models import Secteur, Tendance

# Seuils utilisés pour déterminer le niveau de concurrence
SEUIL_NB_MOYEN = 3       # à partir de 3 concurrents -> au moins "moyen"
SEUIL_NB_ELEVE = 6       # à partir de 6 concurrents -> "eleve"
SEUIL_PART_MOYEN = Decimal("30")  # part cumulée >= 30 % -> au moins "moyen"
SEUIL_PART_ELEVE = Decimal("60")  # part cumulée >= 60 % -> "eleve"


def arrondir(valeur):
    """Arrondit un Decimal à 2 décimales (None -> 0)."""
    return (valeur or Decimal("0")).quantize(Decimal("0.01"))


def decimal(valeur):
    """Nombre JSON reçu d'un autre service -> Decimal exact (via sa représentation texte)."""
    return Decimal(str(valeur if valeur is not None else 0))


def calculer_niveau_concurrence(nb_concurrents, part_cumulee):
    """
    Détermine le niveau de concurrence d'un marché.

    - eleve  : beaucoup de concurrents OU marché déjà largement occupé
    - moyen  : quelques concurrents OU part cumulée significative
    - faible : sinon
    """
    if nb_concurrents >= SEUIL_NB_ELEVE or part_cumulee >= SEUIL_PART_ELEVE:
        return "eleve"
    if nb_concurrents >= SEUIL_NB_MOYEN or part_cumulee >= SEUIL_PART_MOYEN:
        return "moyen"
    return "faible"


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

    nb = len(concurrents)
    prix = [decimal(c["prix_moyen"]) for c in concurrents]
    part_totale = arrondir(sum((decimal(c["part_de_marche"]) for c in concurrents), Decimal("0")))
    prix_moyen = sum(prix, Decimal("0")) / nb if nb else None

    # Top 3 des concurrents par part de marché
    top3 = sorted(concurrents, key=lambda c: (-decimal(c["part_de_marche"]), c["nom"]))[:3]

    # Comptage des tendances par impact (même service : requêtes locales)
    tendances = Tendance.objects.filter(secteur=secteur)
    nb_positives = tendances.filter(impact=Tendance.Impact.POSITIF).count()
    nb_negatives = tendances.filter(impact=Tendance.Impact.NEGATIF).count()

    return {
        "secteur": {"id": secteur.id, "nom": secteur.nom},
        "nombre_concurrents": nb,
        "prix_moyen": arrondir(prix_moyen),
        "part_de_marche_totale": part_totale,
        "top_concurrents": [_concurrent_resume(c) for c in top3],
        "tendances_positives": nb_positives,
        "tendances_negatives": nb_negatives,
        "niveau_concurrence": calculer_niveau_concurrence(nb, part_totale),
    }
