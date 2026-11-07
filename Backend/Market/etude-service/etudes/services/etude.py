"""
Logique métier d'une étude de marché : comparaison des prix, opportunités
et menaces, potentiel commercial et rapport complet (reprise de marche/services/etude.py).

Les calculs portent sur les concurrents et tendances associés à l'étude
(concurrent_ids, tendance_ids), lus en un appel chacun sur CONCURRENT-SERVICE et
SECTEUR-SERVICE puis gardés sur l'instance le temps de la requête. La SWOT est
lue sur SWOT-SERVICE (qui en détient les règles de génération).
"""

from decimal import Decimal

from clients import ConcurrentClient, SecteurClient, SwotClient

from ..models import EtudeMarche
from .analyse import NIVEAU_INCONNU, arrondir, calculer_niveau_concurrence, concurrent_resume, decimal, somme

# Écart (en %) avec le prix moyen au-delà duquel l'offre n'est plus "alignée"
SEUIL_ECART_PRIX = Decimal("10")
# Taux de croissance annuel (en %) à partir duquel le marché est "en forte croissance"
SEUIL_CROISSANCE_FORTE = Decimal("10")

POSITIONNEMENT_INCONNU = "inconnu"  # pas de prix proposé ou aucun concurrent

LIBELLES_NIVEAU = {"faible": "faible", "moyen": "moyen", "eleve": "élevé"}
LIBELLES_POSITIONNEMENT = {"economique": "économique", "aligne": "aligné", "premium": "premium"}

# Seuils du potentiel commercial (score sur SCORE_MAX)
SCORE_MAX = 7
SEUIL_POTENTIEL_FORT = 5
SEUIL_POTENTIEL_MOYEN = 2


# --- Données distantes de l'étude (un appel par service et par requête) --------

def concurrents_de(etude: EtudeMarche):
    """Concurrents de l'étude (CONCURRENT-SERVICE), triés par part de marché décroissante."""
    if not hasattr(etude, "_concurrents"):
        etude._concurrents = ConcurrentClient().list(ids=etude.concurrent_ids)
    return etude._concurrents


def tendances_de(etude: EtudeMarche):
    """Tendances de l'étude (SECTEUR-SERVICE), les plus récentes d'abord."""
    if not hasattr(etude, "_tendances"):
        etude._tendances = SecteurClient().tendances(ids=etude.tendance_ids)
    return etude._tendances


def _pourcentage(valeur):
    """Formate un écart en % pour les textes (ex : -20.00 -> "20 %")."""
    return f"{abs(valeur).normalize():f} %"


def niveau_concurrence_etude(etude: EtudeMarche):
    """
    Niveau de concurrence calculé sur les concurrents identifiés pour l'étude.
    "inconnu" si aucun concurrent n'a encore été identifié.
    """
    concurrents = concurrents_de(etude)
    if not concurrents:
        return NIVEAU_INCONNU
    return calculer_niveau_concurrence(len(concurrents), arrondir(somme(concurrents, "part_de_marche")))


def comparer_prix(etude: EtudeMarche):
    """
    Compare le prix proposé par l'entrepreneur aux prix des concurrents de l'étude.

    Positionnement : economique (< moyenne - 10 %), aligne, premium (> moyenne + 10 %),
    ou inconnu s'il n'y a pas de prix proposé ou aucun concurrent.
    """
    concurrents = sorted(concurrents_de(etude), key=lambda c: (decimal(c["prix_moyen"]), c["nom"]))
    prix = [decimal(c["prix_moyen"]) for c in concurrents]
    nb = len(concurrents)
    moyenne = sum(prix, Decimal("0")) / nb if nb else None
    prix_propose = etude.prix_propose

    ecart = None
    positionnement = POSITIONNEMENT_INCONNU
    if nb and prix_propose is not None:
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

    return {
        "etude_id": etude.id,
        "prix_propose": arrondir(prix_propose) if prix_propose is not None else None,
        "nombre_concurrents": nb,
        "prix_min": arrondir(min(prix)) if nb else None,
        "prix_moyen": arrondir(moyenne) if nb else None,
        "prix_max": arrondir(max(prix)) if nb else None,
        "ecart_moyenne_pct": ecart,
        "positionnement": positionnement,
        "concurrents": [concurrent_resume(c) for c in concurrents],
    }


def _element(source, description):
    return {"source": source, "description": description}


def evaluer_opportunites_menaces(etude: EtudeMarche):
    """
    Opportunités et menaces de l'étude, calculées à partir :
    - des tendances associées (positives -> opportunités, négatives -> menaces)
    - du niveau de concurrence (faible -> opportunité, élevé -> menace)
    - du taux de croissance (> 10 % -> opportunité, < 0 -> menace)
    - du positionnement prix (economique -> opportunité, premium -> menace)
    """
    opportunites, menaces = [], []

    for tendance in tendances_de(etude):
        texte = tendance["titre"]
        if tendance["description"]:
            texte = f"{texte} : {tendance['description']}"
        if tendance["impact"] == "positif":
            opportunites.append(_element("tendance", texte))
        elif tendance["impact"] == "negatif":
            menaces.append(_element("tendance", texte))

    niveau = niveau_concurrence_etude(etude)
    nb_concurrents = len(concurrents_de(etude))
    if niveau == "faible":
        opportunites.append(_element(
            "concurrence", f"Concurrence faible : {nb_concurrents} concurrent(s) identifié(s), "
                           "marché encore peu occupé."))
    elif niveau == "eleve":
        menaces.append(_element(
            "concurrence", f"Concurrence élevée : {nb_concurrents} concurrent(s) identifié(s) "
                           "occupant une large part du marché."))

    croissance = etude.taux_croissance
    if croissance > SEUIL_CROISSANCE_FORTE:
        opportunites.append(_element(
            "croissance", f"Marché en forte croissance (+{_pourcentage(croissance)} par an)."))
    elif croissance < 0:
        menaces.append(_element(
            "croissance", f"Marché en recul ({_pourcentage(croissance)} de baisse par an)."))

    prix = comparer_prix(etude)
    if prix["positionnement"] == "economique":
        opportunites.append(_element(
            "prix", f"Prix inférieur de {_pourcentage(prix['ecart_moyenne_pct'])} à la moyenne "
                    "des concurrents : argument fort pour attirer les clients."))
    elif prix["positionnement"] == "premium":
        texte = "Prix supérieur à celui des concurrents"
        if prix["ecart_moyenne_pct"] is not None:
            texte = (f"Prix supérieur de {_pourcentage(prix['ecart_moyenne_pct'])} "
                     "à la moyenne des concurrents")
        menaces.append(_element("prix", f"{texte} : l'offre doit justifier ce positionnement."))

    return {
        "etude_id": etude.id,
        "niveau_concurrence": niveau,
        "taux_croissance": arrondir(croissance),
        "positionnement_prix": prix["positionnement"],
        "opportunites": opportunites,
        "menaces": menaces,
    }


def _swot_par_type(elements):
    """Regroupe des éléments {type, description, ...} par type SWOT."""
    groupes = {"forces": [], "faiblesses": [], "opportunites": [], "menaces": []}
    cles = {"force": "forces", "faiblesse": "faiblesses",
            "opportunite": "opportunites", "menace": "menaces"}
    for element in elements:
        groupes[cles[element["type"]]].append(element)
    return groupes


def evaluer_potentiel(etude: EtudeMarche, niveau, prix, opportunites_menaces):
    """
    Potentiel commercial (faible / moyen / fort) à partir d'un score sur 7 :
    croissance (0 à 2), concurrence (-1 à 2), prix (0 à 1), tendances (-1 à 1), personas (0 à 1).
    """
    score = 0
    justification = []

    croissance = etude.taux_croissance
    if croissance > SEUIL_CROISSANCE_FORTE:
        score += 2
        justification.append(f"Forte croissance du marché (+{_pourcentage(croissance)}/an) : +2")
    elif croissance > 0:
        score += 1
        justification.append(f"Marché en croissance (+{_pourcentage(croissance)}/an) : +1")
    elif croissance < 0:
        score -= 1
        justification.append(f"Marché en recul ({_pourcentage(croissance)}/an) : -1")

    points_concurrence = {"faible": 2, "moyen": 1, "eleve": -1}
    if niveau in points_concurrence:
        points = points_concurrence[niveau]
        score += points
        justification.append(f"Niveau de concurrence {LIBELLES_NIVEAU[niveau]} : {points:+d}")

    if prix["positionnement"] in ("economique", "aligne"):
        score += 1
        justification.append(
            f"Prix {LIBELLES_POSITIONNEMENT[prix['positionnement']]} par rapport au marché : +1")

    nb_opportunites = sum(1 for e in opportunites_menaces["opportunites"] if e["source"] == "tendance")
    nb_menaces = sum(1 for e in opportunites_menaces["menaces"] if e["source"] == "tendance")
    if nb_opportunites > nb_menaces:
        score += 1
        justification.append("Tendances majoritairement favorables : +1")
    elif nb_menaces > nb_opportunites:
        score -= 1
        justification.append("Tendances majoritairement défavorables : -1")

    if etude.personas.exists():
        score += 1
        justification.append("Cible clients définie par des personas : +1")

    if score >= SEUIL_POTENTIEL_FORT:
        niveau_potentiel = "fort"
    elif score >= SEUIL_POTENTIEL_MOYEN:
        niveau_potentiel = "moyen"
    else:
        niveau_potentiel = "faible"

    return {
        "niveau": niveau_potentiel,
        "score": score,
        "score_max": SCORE_MAX,
        "justification": justification,
        "conclusion": f"Potentiel commercial {niveau_potentiel} (score {score}/{SCORE_MAX}).",
    }


def generer_rapport(etude: EtudeMarche):
    """
    Rapport complet d'une étude de marché (utilisé en JSON et pour le PDF).

    La SWOT reprend les éléments enregistrés dans SWOT-SERVICE ; si l'étude n'en a aucun,
    SWOT-SERVICE la calcule à la volée sans l'enregistrer (source = "calculee").
    Si le secteur a été supprimé dans SECTEUR-SERVICE, son nom vaut null.
    """
    prix = comparer_prix(etude)
    opportunites_menaces = evaluer_opportunites_menaces(etude)
    niveau = opportunites_menaces["niveau_concurrence"]

    swot = SwotClient()
    enregistres = swot.de_l_etude(etude.id)
    if enregistres:
        swot_source = "enregistree"
        elements = [
            {"type": e["type"], "description": e["description"],
             "genere_automatiquement": e["genere_automatiquement"]}
            for e in enregistres
        ]
    else:
        swot_source = "calculee"
        elements = [
            {"type": e["type"], "description": e["description"], "genere_automatiquement": True}
            for e in swot.apercu(etude.id)
        ]

    return {
        "etude": {
            "id": etude.id,
            "titre": etude.titre,
            "projet_id": etude.projet_id,
            "entrepreneur_id": etude.entrepreneur_id,
            "statut": etude.statut,
            "date_creation": etude.date_creation,
            "date_mise_a_jour": etude.date_mise_a_jour,
        },
        "marche_cible": {
            "secteur": {"id": etude.secteur_id, "nom": SecteurClient().nom(etude.secteur_id)},
            "cible": etude.cible,
            "zone_geographique": etude.zone_geographique,
            "taille_marche": arrondir(etude.taille_marche),
            "taux_croissance": arrondir(etude.taux_croissance),
        },
        "hypotheses": etude.hypotheses,
        "offre": {
            "description": etude.description_offre,
            "prix_propose": prix["prix_propose"],
        },
        "tendances": [
            {"id": t["id"], "titre": t["titre"], "impact": t["impact"], "description": t["description"]}
            for t in tendances_de(etude)
        ],
        "concurrents": [
            {**concurrent_resume(c), "site_web": c["site_web"],
             "forces": c["forces"], "faiblesses": c["faiblesses"]}
            for c in sorted(concurrents_de(etude), key=lambda c: (-decimal(c["part_de_marche"]), c["nom"]))
        ],
        "comparaison_prix": prix,
        "personas": [
            {
                "id": p.id, "nom": p.nom, "tranche_age": p.tranche_age,
                "profession": p.profession, "localisation": p.localisation,
                "revenu_estime": arrondir(p.revenu_estime) if p.revenu_estime is not None else None,
                "besoins": p.besoins, "frustrations": p.frustrations,
                "comportement_achat": p.comportement_achat,
            }
            for p in etude.personas.all()
        ],
        "opportunites_menaces": {
            "opportunites": opportunites_menaces["opportunites"],
            "menaces": opportunites_menaces["menaces"],
        },
        "swot": {"source": swot_source, **_swot_par_type(elements)},
        "niveau_concurrence": niveau,
        "potentiel_commercial": evaluer_potentiel(etude, niveau, prix, opportunites_menaces),
    }
