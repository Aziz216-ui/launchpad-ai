"""
Logique métier d'analyse du marché.

Les vues se contentent d'appeler ces fonctions : toute la logique
de calcul est regroupée ici pour être facilement testable et réutilisable.
"""

from decimal import Decimal

from django.db.models import Avg, Count, Sum

from ..models import Concurrent, EtudeMarche, Secteur, Tendance

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
        "id": concurrent.id,
        "nom": concurrent.nom,
        "pays": concurrent.pays,
        "prix_moyen": arrondir(concurrent.prix_moyen),
        "part_de_marche": arrondir(concurrent.part_de_marche),
    }


def analyser_secteur(secteur: Secteur):
    """Statistiques d'un secteur : concurrents, prix, parts de marché, tendances."""
    concurrents = Concurrent.objects.filter(secteur=secteur)

    stats = concurrents.aggregate(
        nb=Count("id"),
        prix_moyen=Avg("prix_moyen"),
        part_totale=Sum("part_de_marche"),
    )
    part_totale = arrondir(stats["part_totale"])

    # Top 3 des concurrents par part de marché
    top3 = concurrents.order_by("-part_de_marche", "nom")[:3]

    # Comptage des tendances par impact
    tendances = Tendance.objects.filter(secteur=secteur)
    nb_positives = tendances.filter(impact=Tendance.Impact.POSITIF).count()
    nb_negatives = tendances.filter(impact=Tendance.Impact.NEGATIF).count()

    return {
        "secteur": {"id": secteur.id, "nom": secteur.nom},
        "nombre_concurrents": stats["nb"],
        "prix_moyen": arrondir(stats["prix_moyen"]),
        "part_de_marche_totale": part_totale,
        "top_concurrents": [_concurrent_resume(c) for c in top3],
        "tendances_positives": nb_positives,
        "tendances_negatives": nb_negatives,
        "niveau_concurrence": calculer_niveau_concurrence(stats["nb"], part_totale),
    }


def analyser_projet(projet_id: int):
    """
    Résumé du marché pour un projet : ses études, les secteurs concernés,
    les concurrents et tendances associés, et le niveau de concurrence.

    Un projet sans étude n'est pas une erreur : on renvoie alors une
    structure vide avec le niveau de concurrence "inconnu".
    """
    etudes = EtudeMarche.objects.filter(projet_id=projet_id).select_related("secteur")

    secteur_ids = etudes.values_list("secteur_id", flat=True).distinct()
    secteurs = Secteur.objects.filter(id__in=secteur_ids)

    analyse_secteurs = []
    tous_concurrents = []  # concurrents de tous les secteurs du projet
    toutes_tendances = []  # tendances de tous les secteurs du projet
    # Sans étude (donc sans secteur), le niveau reste "inconnu"
    niveau_global = NIVEAU_INCONNU
    for secteur in secteurs:
        concurrents = Concurrent.objects.filter(secteur=secteur)
        tendances = Tendance.objects.filter(secteur=secteur)

        nb = concurrents.count()
        part_cumulee = arrondir(concurrents.aggregate(total=Sum("part_de_marche"))["total"])
        niveau = calculer_niveau_concurrence(nb, part_cumulee)

        # Le niveau global du projet est le plus élevé de ses secteurs
        if NIVEAUX.index(niveau) > NIVEAUX.index(niveau_global):
            niveau_global = niveau

        liste_concurrents = [_concurrent_resume(c) for c in concurrents]
        liste_tendances = [
            {"id": t.id, "titre": t.titre, "impact": t.impact} for t in tendances
        ]
        tous_concurrents.extend(liste_concurrents)
        toutes_tendances.extend(liste_tendances)

        analyse_secteurs.append({
            "id": secteur.id,
            "nom": secteur.nom,
            "nombre_concurrents": nb,
            "part_de_marche_cumulee": part_cumulee,
            "niveau_concurrence": niveau,
            "concurrents": liste_concurrents,
            "tendances": liste_tendances,
        })

    return {
        "projet_id": projet_id,
        "nombre_etudes": etudes.count(),
        "etudes": [
            {
                "id": e.id,
                "titre": e.titre,
                "secteur": e.secteur.nom,
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
