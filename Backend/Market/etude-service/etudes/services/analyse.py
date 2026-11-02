"""
Analyse du marché d'un projet (reprise de marche/services/analyse.py).

Les études sont locales ; les secteurs, concurrents et tendances sont lus sur
SECTEUR-SERVICE et CONCURRENT-SERVICE (découverts via Eureka).
"""

from decimal import Decimal

from clients import ConcurrentClient, SecteurClient

from ..models import EtudeMarche

# Seuils utilisés pour déterminer le niveau de concurrence
SEUIL_NB_MOYEN = 3       # à partir de 3 concurrents -> au moins "moyen"
SEUIL_NB_ELEVE = 6       # à partir de 6 concurrents -> "eleve"
SEUIL_PART_MOYEN = Decimal("30")  # part cumulée >= 30 % -> au moins "moyen"
SEUIL_PART_ELEVE = Decimal("60")  # part cumulée >= 60 % -> "eleve"

# Ordre des niveaux (pour comparer et garder le plus élevé).
# "inconnu" : projet sans étude de marché, on ne peut pas évaluer la concurrence.
NIVEAU_INCONNU = "inconnu"
NIVEAUX = [NIVEAU_INCONNU, "faible", "moyen", "eleve"]


def arrondir(valeur):
    """Arrondit un Decimal à 2 décimales (None -> 0)."""
    return (valeur or Decimal("0")).quantize(Decimal("0.01"))


def decimal(valeur):
    """Nombre JSON reçu d'un autre service -> Decimal exact (via sa représentation texte)."""
    return Decimal(str(valeur if valeur is not None else 0))


def somme(concurrents, champ):
    return sum((decimal(c[champ]) for c in concurrents), Decimal("0"))


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


def concurrent_resume(concurrent):
    """Représentation courte d'un concurrent (reçu de CONCURRENT-SERVICE) pour les analyses."""
    return {
        "id": concurrent["id"],
        "nom": concurrent["nom"],
        "pays": concurrent["pays"],
        "prix_moyen": arrondir(decimal(concurrent["prix_moyen"])),
        "part_de_marche": arrondir(decimal(concurrent["part_de_marche"])),
    }


def analyser_projet(projet_id: int):
    """
    Résumé du marché pour un projet : ses études, les secteurs concernés,
    les concurrents et tendances associés, et le niveau de concurrence.

    Un projet sans étude n'est pas une erreur : on renvoie alors une
    structure vide avec le niveau de concurrence "inconnu" (aucun appel distant).
    Un secteur supprimé dans SECTEUR-SERVICE est ignoré (nom de secteur null dans "etudes").
    """
    etudes = list(EtudeMarche.objects.filter(projet_id=projet_id))

    secteur_ids = {e.secteur_id for e in etudes}
    secteurs = SecteurClient().list(ids=secteur_ids) if secteur_ids else []  # triés par nom
    noms = {s["id"]: s["nom"] for s in secteurs}

    analyse_secteurs = []
    tous_concurrents = []  # concurrents de tous les secteurs du projet
    toutes_tendances = []  # tendances de tous les secteurs du projet
    # Sans étude (donc sans secteur), le niveau reste "inconnu"
    niveau_global = NIVEAU_INCONNU
    for secteur in secteurs:
        concurrents = ConcurrentClient().du_secteur(secteur["id"])
        tendances = SecteurClient().tendances(secteur=secteur["id"])

        nb = len(concurrents)
        part_cumulee = arrondir(somme(concurrents, "part_de_marche"))
        niveau = calculer_niveau_concurrence(nb, part_cumulee)

        # Le niveau global du projet est le plus élevé de ses secteurs
        if NIVEAUX.index(niveau) > NIVEAUX.index(niveau_global):
            niveau_global = niveau

        liste_concurrents = [concurrent_resume(c) for c in concurrents]
        liste_tendances = [
            {"id": t["id"], "titre": t["titre"], "impact": t["impact"]} for t in tendances
        ]
        tous_concurrents.extend(liste_concurrents)
        toutes_tendances.extend(liste_tendances)

        analyse_secteurs.append({
            "id": secteur["id"],
            "nom": secteur["nom"],
            "nombre_concurrents": nb,
            "part_de_marche_cumulee": part_cumulee,
            "niveau_concurrence": niveau,
            "concurrents": liste_concurrents,
            "tendances": liste_tendances,
        })

    return {
        "projet_id": projet_id,
        "nombre_etudes": len(etudes),
        "etudes": [
            {
                "id": e.id,
                "titre": e.titre,
                "secteur": noms.get(e.secteur_id),
                "taille_marche": arrondir(e.taille_marche),
                "taux_croissance": arrondir(e.taux_croissance),
                "cible": e.cible,
                "zone_geographique": e.zone_geographique,
            }
            for e in etudes
        ],
        "secteurs": analyse_secteurs,
        "concurrents": tous_concurrents,
        "tendances": toutes_tendances,
        "niveau_concurrence": niveau_global,
    }
