"""
Analyse du marché d'un projet (reprise de marche/services/analyse.py).

Les études sont locales ; les secteurs, concurrents et tendances sont lus sur
SECTEUR-SERVICE et CONCURRENT-SERVICE (découverts via Eureka).

Les concurrents pris en compte sont ceux ASSOCIÉS aux études (concurrent_ids), avec
la même règle de niveau que la page d'une étude (market_commun.concurrence) :
retirer un concurrent d'une étude change donc l'analyse du projet.
"""

from decimal import Decimal

from clients import ConcurrentClient, SecteurClient
from market_commun.concurrence import (  # noqa: F401 (réexportés pour etude.py et les tests)
    NIVEAU_INCONNU, NIVEAUX, arrondir, calculer_niveau_concurrence, decimal, niveau_des_concurrents,
    niveau_le_plus_eleve, part_cumulee, prix_moyen,
)

from ..models import EtudeMarche

# Écart (en %) avec le prix moyen au-delà duquel l'offre n'est plus "alignée"
SEUIL_ECART_PRIX = Decimal("10")
POSITIONNEMENT_INCONNU = "inconnu"  # pas de prix proposé ou aucun concurrent

# Origine des tendances d'un secteur dans l'analyse du projet
TENDANCES_DES_ETUDES = "etudes"    # tendances retenues dans les études (tendance_ids)
TENDANCES_DU_SECTEUR = "secteur"   # aucune retenue : toutes celles du secteur


def somme(concurrents, champ):
    return sum((decimal(c[champ]) for c in concurrents), Decimal("0"))


def concurrent_resume(concurrent):
    """Représentation courte d'un concurrent (reçu de CONCURRENT-SERVICE) pour les analyses."""
    return {
        "id": concurrent["id"],
        "nom": concurrent["nom"],
        "pays": concurrent["pays"],
        "prix_moyen": arrondir(decimal(concurrent["prix_moyen"])),
        "part_de_marche": arrondir(decimal(concurrent["part_de_marche"])),
    }


def positionner_prix(prix_propose, concurrents):
    """
    Position du prix proposé face aux prix des concurrents (règle de /etudes/<id>/comparaison-prix/).

    Renvoie (prix_moyen, ecart_pct, positionnement) : economique (< moyenne - 10 %), aligne,
    premium (> moyenne + 10 %), ou inconnu s'il n'y a pas de prix proposé ou aucun concurrent.
    """
    moyenne = prix_moyen(concurrents)
    ecart = None
    positionnement = POSITIONNEMENT_INCONNU
    if moyenne is not None and prix_propose is not None:
        if moyenne > 0:
            ecart = arrondir((prix_propose - moyenne) / moyenne * 100)
            if ecart < -SEUIL_ECART_PRIX:
                positionnement = "economique"
            elif ecart > SEUIL_ECART_PRIX:
                positionnement = "premium"
            else:
                positionnement = "aligne"
        else:
            # Marché gratuit : seul un prix nul est aligné
            positionnement = "aligne" if prix_propose == 0 else "premium"
    return moyenne, ecart, positionnement


def _ids_uniques(listes):
    """Union de listes d'ids, ordre de première apparition conservé."""
    return list(dict.fromkeys(i for ids in listes for i in ids))


def _resume_etude(etude, noms, concurrents_par_id):
    """Résumé d'une étude, avec la comparaison de prix sur ses propres concurrents."""
    concurrents = [concurrents_par_id[i] for i in etude.concurrent_ids if i in concurrents_par_id]
    moyenne, ecart, positionnement = positionner_prix(etude.prix_propose, concurrents)
    return {
        "id": etude.id,
        "titre": etude.titre,
        "secteur": noms.get(etude.secteur_id),
        "taille_marche": arrondir(etude.taille_marche),
        "taux_croissance": arrondir(etude.taux_croissance),
        "cible": etude.cible,
        "zone_geographique": etude.zone_geographique,
        "prix_propose": arrondir(etude.prix_propose) if etude.prix_propose is not None else None,
        "prix_moyen_concurrents": arrondir(moyenne) if moyenne is not None else None,
        "ecart_pourcentage": ecart,
        "positionnement": positionnement,
    }


def analyser_projet(projet_id: int):
    """
    Résumé du marché pour un projet : ses études, les secteurs concernés,
    les concurrents et tendances associés, et le niveau de concurrence.

    - Concurrents : union des concurrent_ids des études (un appel ?ids=), regroupés par secteur
      de l'étude ; niveau par secteur = règle de la page d'une étude ("inconnu" sans concurrent) ;
      niveau global = le plus élevé des secteurs.
    - Tendances : celles retenues dans les études du secteur (tendance_ids) ; s'il n'y en a
      aucune, celles du secteur (champ "source_tendances" : "etudes" ou "secteur").
    - Études : prix proposé, prix moyen de leurs concurrents, écart et positionnement.

    Un projet sans étude n'est pas une erreur : on renvoie alors une
    structure vide avec le niveau de concurrence "inconnu" (aucun appel distant).
    Un secteur supprimé dans SECTEUR-SERVICE (secteur_id null) est ignoré : nom de secteur
    null dans "etudes".
    """
    etudes = list(EtudeMarche.objects.filter(projet_id=projet_id))

    secteur_ids = {e.secteur_id for e in etudes if e.secteur_id is not None}
    secteurs = SecteurClient().list(ids=secteur_ids) if secteur_ids else []  # triés par nom
    noms = {s["id"]: s["nom"] for s in secteurs}

    # Un appel par service pour toutes les études (ids inexistants ignorés)
    tous_ids = _ids_uniques(e.concurrent_ids for e in etudes)
    concurrents_par_id = {c["id"]: c for c in ConcurrentClient().list(ids=tous_ids)} if tous_ids else {}
    tendance_ids = _ids_uniques(e.tendance_ids for e in etudes)
    tendances_par_id = {t["id"]: t for t in SecteurClient().tendances(ids=tendance_ids)} if tendance_ids else {}

    analyse_secteurs = []
    tous_concurrents = []  # concurrents associés aux études du projet (sans doublon)
    toutes_tendances = []
    deja_vus = set()
    for secteur in secteurs:
        etudes_du_secteur = [e for e in etudes if e.secteur_id == secteur["id"]]

        ids = _ids_uniques(e.concurrent_ids for e in etudes_du_secteur)
        concurrents = [concurrents_par_id[i] for i in ids if i in concurrents_par_id]

        ids = _ids_uniques(e.tendance_ids for e in etudes_du_secteur)
        tendances = [tendances_par_id[i] for i in ids if i in tendances_par_id]
        source_tendances = TENDANCES_DES_ETUDES
        if not tendances:
            tendances = SecteurClient().tendances(secteur=secteur["id"])
            source_tendances = TENDANCES_DU_SECTEUR

        liste_concurrents = [concurrent_resume(c) for c in concurrents]
        liste_tendances = [
            {"id": t["id"], "titre": t["titre"], "impact": t["impact"]} for t in tendances
        ]
        for c in liste_concurrents:
            if c["id"] not in deja_vus:
                deja_vus.add(c["id"])
                tous_concurrents.append(c)
        toutes_tendances.extend(liste_tendances)

        analyse_secteurs.append({
            "id": secteur["id"],
            "nom": secteur["nom"],
            "nombre_concurrents": len(concurrents),
            "part_de_marche_cumulee": part_cumulee(concurrents),
            "niveau_concurrence": niveau_des_concurrents(concurrents),
            "concurrents": liste_concurrents,
            "tendances": liste_tendances,
            "source_tendances": source_tendances,
        })

    return {
        "projet_id": projet_id,
        "nombre_etudes": len(etudes),
        "etudes": [_resume_etude(e, noms, concurrents_par_id) for e in etudes],
        "secteurs": analyse_secteurs,
        "concurrents": tous_concurrents,
        "tendances": toutes_tendances,
        # Le plus élevé des secteurs ; "inconnu" sans étude ou sans aucun concurrent associé
        "niveau_concurrence": niveau_le_plus_eleve(s["niveau_concurrence"] for s in analyse_secteurs),
    }
