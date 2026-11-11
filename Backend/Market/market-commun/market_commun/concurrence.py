"""
Niveau de concurrence d'un marché : règle unique partagée par secteur-service
(GET /analyse/secteur/<id>/) et etude-service (page d'une étude, GET /analyse/projet/<id>/).

Les concurrents sont au format JSON de CONCURRENT-SERVICE ({"part_de_marche": ..., ...}).
Sans aucun concurrent, on ne peut pas évaluer la concurrence : le niveau est "inconnu".
"""

from decimal import Decimal

# Seuils utilisés pour déterminer le niveau de concurrence
SEUIL_NB_MOYEN = 3       # à partir de 3 concurrents -> au moins "moyen"
SEUIL_NB_ELEVE = 6       # à partir de 6 concurrents -> "eleve"
SEUIL_PART_MOYEN = Decimal("30")  # part cumulée >= 30 % -> au moins "moyen"
SEUIL_PART_ELEVE = Decimal("60")  # part cumulée >= 60 % -> "eleve"

NIVEAU_INCONNU = "inconnu"
# Ordre des niveaux, du plus bas au plus élevé (pour garder le plus élevé de plusieurs marchés)
NIVEAUX = [NIVEAU_INCONNU, "faible", "moyen", "eleve"]


def decimal(valeur):
    """Nombre JSON reçu d'un autre service -> Decimal exact (via sa représentation texte)."""
    return Decimal(str(valeur if valeur is not None else 0))


def arrondir(valeur):
    """Arrondit un Decimal à 2 décimales (None -> 0)."""
    return (valeur or Decimal("0")).quantize(Decimal("0.01"))


def part_cumulee(concurrents):
    """Somme des parts de marché des concurrents, arrondie à 2 décimales."""
    return arrondir(sum((decimal(c["part_de_marche"]) for c in concurrents), Decimal("0")))


def prix_moyen(concurrents):
    """Prix moyen des concurrents (Decimal non arrondi), ou None s'il n'y en a aucun."""
    if not concurrents:
        return None
    return sum((decimal(c["prix_moyen"]) for c in concurrents), Decimal("0")) / len(concurrents)


def calculer_niveau_concurrence(nb_concurrents, part_cumulee_pct):
    """
    Détermine le niveau de concurrence d'un marché.

    - inconnu : aucun concurrent identifié (rien à évaluer)
    - eleve   : beaucoup de concurrents OU marché déjà largement occupé
    - moyen   : quelques concurrents OU part cumulée significative
    - faible  : sinon
    """
    if nb_concurrents == 0:
        return NIVEAU_INCONNU
    if nb_concurrents >= SEUIL_NB_ELEVE or part_cumulee_pct >= SEUIL_PART_ELEVE:
        return "eleve"
    if nb_concurrents >= SEUIL_NB_MOYEN or part_cumulee_pct >= SEUIL_PART_MOYEN:
        return "moyen"
    return "faible"


def niveau_des_concurrents(concurrents):
    """Niveau de concurrence d'une liste de concurrents (format CONCURRENT-SERVICE)."""
    return calculer_niveau_concurrence(len(concurrents), part_cumulee(concurrents))


def niveau_le_plus_eleve(niveaux):
    """Le plus élevé des niveaux donnés ("inconnu" si la liste est vide)."""
    return max(niveaux, key=NIVEAUX.index, default=NIVEAU_INCONNU)
