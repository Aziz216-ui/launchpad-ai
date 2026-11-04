"""
Logique métier d'une étude de marché : comparaison des prix, opportunités
et menaces, génération de la SWOT et rapport complet.

Les calculs portent sur les concurrents et tendances associés à l'étude
(champs ManyToMany), et non sur tout le secteur.
"""

from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Max, Min, Sum

from ..models import ElementSWOT, EtudeMarche, Tendance
from .analyse import NIVEAU_INCONNU, arrondir, calculer_niveau_concurrence

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


def _concurrent_prix(concurrent):
    return {
        "id": concurrent.id,
        "nom": concurrent.nom,
        "pays": concurrent.pays,
        "prix_moyen": arrondir(concurrent.prix_moyen),
        "part_de_marche": arrondir(concurrent.part_de_marche),
    }


def _pourcentage(valeur):
    """Formate un écart en % pour les textes (ex : -20.00 -> "20 %")."""
    return f"{abs(valeur).normalize():f} %"


def niveau_concurrence_etude(etude: EtudeMarche):
    """
    Niveau de concurrence calculé sur les concurrents identifiés pour l'étude.
    "inconnu" si aucun concurrent n'a encore été identifié.
    """
    concurrents = etude.concurrents.all()
    nb = concurrents.count()
    if nb == 0:
        return NIVEAU_INCONNU
    part = arrondir(concurrents.aggregate(total=Sum("part_de_marche"))["total"])
    return calculer_niveau_concurrence(nb, part)


def comparer_prix(etude: EtudeMarche):
    """
    Compare le prix proposé par l'entrepreneur aux prix des concurrents de l'étude.

    Positionnement : economique (< moyenne - 10 %), aligne, premium (> moyenne + 10 %),
    ou inconnu s'il n'y a pas de prix proposé ou aucun concurrent.
    """
    concurrents = etude.concurrents.order_by("prix_moyen", "nom")
    # Alias différents du nom du champ (sinon Django confond l'alias et le champ)
    stats = concurrents.aggregate(
        minimum=Min("prix_moyen"), moyenne=Avg("prix_moyen"), maximum=Max("prix_moyen"),
    )
    nb = concurrents.count()
    prix_propose = etude.prix_propose

    ecart = None
    positionnement = POSITIONNEMENT_INCONNU
    if nb and prix_propose is not None:
        moyenne = stats["moyenne"]
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
        "prix_min": arrondir(stats["minimum"]) if nb else None,
        "prix_moyen": arrondir(stats["moyenne"]) if nb else None,
        "prix_max": arrondir(stats["maximum"]) if nb else None,
        "ecart_moyenne_pct": ecart,
        "positionnement": positionnement,
        "concurrents": [_concurrent_prix(c) for c in concurrents],
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

    for tendance in etude.tendances.all():
        texte = tendance.titre
        if tendance.description:
            texte = f"{texte} : {tendance.description}"
        if tendance.impact == Tendance.Impact.POSITIF:
            opportunites.append(_element("tendance", texte))
        elif tendance.impact == Tendance.Impact.NEGATIF:
            menaces.append(_element("tendance", texte))

    niveau = niveau_concurrence_etude(etude)
    nb_concurrents = etude.concurrents.count()
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


def calculer_elements_swot(etude: EtudeMarche):
    """
    Éléments SWOT déduits par règles simples, sous forme de (type, description).

    Forces / faiblesses : facteurs internes (prix, personas, offre, concurrents étudiés).
    Opportunités / menaces : facteurs externes, repris de evaluer_opportunites_menaces
    (hors positionnement prix, déjà compté en force ou faiblesse).
    """
    T = ElementSWOT.Type
    elements = []

    prix = comparer_prix(etude)
    if prix["positionnement"] == "economique":
        elements.append((T.FORCE, f"Prix proposé inférieur de {_pourcentage(prix['ecart_moyenne_pct'])} "
                                  "à la moyenne des concurrents."))
    elif prix["positionnement"] == "premium":
        elements.append((T.FAIBLESSE, "Prix proposé supérieur à la moyenne des concurrents."))
    elif prix["positionnement"] == "aligne":
        elements.append((T.FORCE, "Prix proposé aligné sur le marché."))
    if etude.prix_propose is None:
        elements.append((T.FAIBLESSE, "Offre non chiffrée : aucun prix proposé."))

    nb_personas = etude.personas.count()
    if nb_personas:
        elements.append((T.FORCE, f"Cible clients définie ({nb_personas} persona(s))."))
    else:
        elements.append((T.FAIBLESSE, "Cible clients non définie : aucun persona."))

    if not etude.description_offre.strip():
        elements.append((T.FAIBLESSE, "Offre non décrite."))
    if not etude.concurrents.exists():
        elements.append((T.FAIBLESSE, "Concurrence non étudiée : aucun concurrent identifié."))

    externes = evaluer_opportunites_menaces(etude)
    for element in externes["opportunites"]:
        if element["source"] != "prix":
            elements.append((T.OPPORTUNITE, element["description"]))
    for element in externes["menaces"]:
        if element["source"] != "prix":
            elements.append((T.MENACE, element["description"]))

    return elements


@transaction.atomic
def generer_swot(etude: EtudeMarche):
    """
    (Re)génère les éléments SWOT automatiques de l'étude.

    Seuls les éléments générés automatiquement sont remplacés :
    ceux saisis à la main sont conservés. Renvoie le nombre d'éléments générés.
    """
    etude.swot.filter(genere_automatiquement=True).delete()
    nouveaux = [
        ElementSWOT(etude=etude, type=type_, description=description, genere_automatiquement=True)
        for type_, description in calculer_elements_swot(etude)
    ]
    ElementSWOT.objects.bulk_create(nouveaux)
    return len(nouveaux)


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

    La SWOT reprend les éléments enregistrés ; si l'étude n'en a aucun,
    elle est calculée à la volée sans être enregistrée (source = "calculee").
    """
    prix = comparer_prix(etude)
    opportunites_menaces = evaluer_opportunites_menaces(etude)
    niveau = opportunites_menaces["niveau_concurrence"]

    enregistres = list(etude.swot.all())
    if enregistres:
        swot_source = "enregistree"
        elements = [
            {"type": e.type, "description": e.description,
             "genere_automatiquement": e.genere_automatiquement}
            for e in enregistres
        ]
    else:
        swot_source = "calculee"
        elements = [
            {"type": type_, "description": description, "genere_automatiquement": True}
            for type_, description in calculer_elements_swot(etude)
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
            "secteur": {"id": etude.secteur_id, "nom": etude.secteur.nom},
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
            {"id": t.id, "titre": t.titre, "impact": t.impact, "description": t.description}
            for t in etude.tendances.all()
        ],
        "concurrents": [
            {**_concurrent_prix(c), "site_web": c.site_web,
             "forces": c.forces, "faiblesses": c.faiblesses}
            for c in etude.concurrents.order_by("-part_de_marche", "nom")
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
