"""
Moteur de regles — repli complet sans cle LLM.
Fournit : analyse forces/faiblesses, recommandations ordonnees, reponse de chat.
"""
from __future__ import annotations
from typing import Any


# ── Analyse forces / faiblesses ───────────────────────────────────────────────

def analyser_projet(projet, donnees_marche: dict) -> dict:
    """
    Analyse un projet par regles et retourne :
    - forces (list[str])
    - faiblesses (list[str])
    - score_global (int 0-100)
    - resume (str)
    """
    forces = []
    faiblesses = []
    score = 50  # Base

    # --- Champs du projet ---
    if projet.idee and len(projet.idee) > 50:
        forces.append("Idee bien detaillee et documentee.")
        score += 5
    else:
        faiblesses.append("L'idee manque de detail — developper la description.")
        score -= 5

    if projet.objectifs and len(projet.objectifs) > 30:
        forces.append("Objectifs clairement definis.")
        score += 5
    else:
        faiblesses.append("Les objectifs sont vagues ou absents — les formaliser.")
        score -= 10

    if projet.public_cible:
        forces.append(f"Public cible identifie : {projet.public_cible[:60]}.")
        score += 5
    else:
        faiblesses.append("Aucun public cible defini — identifier le segment client.")
        score -= 5

    if projet.budget_estime and float(projet.budget_estime) > 0:
        forces.append(f"Budget estime fourni : {projet.budget_estime} EUR.")
        score += 5
    else:
        faiblesses.append("Aucun budget estime — realiser un previsionnel financier.")
        score -= 5

    if projet.secteur:
        forces.append(f"Secteur clairement identifie : {projet.secteur}.")
        score += 3
    else:
        faiblesses.append("Secteur d'activite non precise.")
        score -= 3

    # --- Donnees du Market-Service ---
    niveau = (donnees_marche.get("niveau_concurrence") or "inconnu").lower()
    nb_concurrents = len(donnees_marche.get("concurrents", []))
    nb_etudes = len(donnees_marche.get("etudes", []))

    if niveau in ("eleve", "eleve"):
        faiblesses.append(f"Concurrence elevee ({nb_concurrents} concurrent(s)) — differentiation requise.")
        score -= 10
    elif niveau == "moyen":
        faiblesses.append("Concurrence moderee — surveiller le marche.")
        score -= 5
    elif niveau == "faible":
        forces.append("Concurrence faible — opportunite de marche.")
        score += 10

    if nb_etudes > 0:
        forces.append(f"{nb_etudes} etude(s) de marche disponible(s).")
        score += 5

    tendances = donnees_marche.get("tendances", [])
    croissances = [t for t in tendances if isinstance(t, dict)
                   and str(t.get("evolution", "")).lower() in ("forte_croissance", "croissance", "hausse", "positive")]
    if croissances:
        forces.append("Le marche est en croissance — fenetre d'opportunite.")
        score += 8

    score = max(0, min(100, score))

    resume_parts = [
        f"Score de viabilite : {score}/100.",
        f"Forces identifies : {len(forces)}. Faiblesses : {len(faiblesses)}.",
    ]
    if niveau != "inconnu":
        resume_parts.append(f"Niveau de concurrence : {niveau}.")
    resume = " ".join(resume_parts)

    return {"forces": forces, "faiblesses": faiblesses, "score_global": score, "resume": resume}


# ── Recommandations / prochaines etapes ──────────────────────────────────────

def generer_recommandations(projet, analyse=None, donnees_marche: dict = None) -> list[dict]:
    """
    Genere des recommandations ordonnees pour le projet.
    """
    if donnees_marche is None:
        donnees_marche = {}

    recos = []
    ordre = 1

    # Recommandation financiere
    if not projet.budget_estime:
        recos.append({
            "categorie": "financier", "ordre": ordre,
            "titre": "Etablir un previsionnel financier",
            "description": "Realisez un business plan financier (compte de resultat, plan de tresorerie) sur 3 ans.",
            "priorite": "haute",
        })
        ordre += 1

    # Recommandation marche
    if not projet.public_cible:
        recos.append({
            "categorie": "marche", "ordre": ordre,
            "titre": "Definir le public cible",
            "description": "Identifiez votre segment client principal (age, besoins, comportements d'achat).",
            "priorite": "haute",
        })
        ordre += 1

    # Concurrence elevee
    niveau = (donnees_marche.get("niveau_concurrence") or "").lower()
    if niveau in ("eleve", "eleve"):
        recos.append({
            "categorie": "marche", "ordre": ordre,
            "titre": "Developper une strategie de differenciation",
            "description": "Identifiez votre proposition de valeur unique (UVP) face a la concurrence elevee.",
            "priorite": "haute",
        })
        ordre += 1

    # Recommandation produit
    if projet.stade in ("idee", "prototype"):
        recos.append({
            "categorie": "produit", "ordre": ordre,
            "titre": "Construire un MVP (Produit Minimum Viable)",
            "description": "Developpez une version minimale de votre produit pour valider vos hypotheses avec de vrais utilisateurs.",
            "priorite": "haute",
        })
        ordre += 1

    # Recommandation juridique
    recos.append({
        "categorie": "juridique", "ordre": ordre,
        "titre": "Choisir la structure juridique",
        "description": "Consultez un expert juridique pour choisir la forme sociale (SARL, SAS...) adaptee a votre projet.",
        "priorite": "moyenne",
    })
    ordre += 1

    # Recommandation equipe
    recos.append({
        "categorie": "equipe", "ordre": ordre,
        "titre": "Constituer l'equipe fondatrice",
        "description": "Identifiez les competences manquantes et recrutez des co-fondateurs ou des premiers collaborateurs.",
        "priorite": "moyenne",
    })

    return recos


# ── Reponse de chat ───────────────────────────────────────────────────────────

def repondre_chat(question: str, projet, historique: list, analyse=None, donnees_marche: dict = None) -> str:
    """
    Genere une reponse de co-fondateur IA par regles (sans LLM).
    La reponse est contextuelle au projet.
    """
    if donnees_marche is None:
        donnees_marche = {}

    q = question.lower()
    titre = projet.titre
    stade = projet.get_stade_display()

    # Reponses contextuelles selon les mots-cles
    if any(mot in q for mot in ("bonjour", "salut", "hello", "bonsoir")):
        return (
            f"Bonjour ! Je suis votre co-fondateur IA pour le projet « {titre} ». "
            f"Vous en etes au stade {stade}. Comment puis-je vous aider aujourd'hui ?"
        )

    if any(mot in q for mot in ("financement", "investisseur", "levee de fonds", "argent", "budget")):
        budget = f"{projet.budget_estime} EUR" if projet.budget_estime else "non defini"
        return (
            f"Pour le financement de « {titre} » (budget estime : {budget}), "
            f"je vous recommande de : 1) Finaliser votre business plan avec un previsionnel sur 3 ans, "
            f"2) Cibler des business angels si vous etes en pre-amorçage, "
            f"3) Explorer les aides publiques (BPI France, subventions regionales). "
            f"Voulez-vous que je detaille l'une de ces pistes ?"
        )

    if any(mot in q for mot in ("concurrent", "concurrence", "competiteur", "marche")):
        niveau = donnees_marche.get("niveau_concurrence", "inconnu")
        nb = len(donnees_marche.get("concurrents", []))
        return (
            f"Sur le marche de « {titre} », le niveau de concurrence est : {niveau} "
            f"({nb} concurrent(s) identifies). "
            f"Pour vous differencier : identifiez votre UVP (valeur unique), "
            f"ciblez un segment de niche, et investissez dans la marque. "
            f"Avez-vous deja realise une analyse SWOT ?"
        )

    if any(mot in q for mot in ("mvp", "prototype", "produit", "developper", "lancer")):
        return (
            f"Pour « {titre} » au stade {stade}, je recommande : "
            f"1) Definir les 3 fonctionnalites core de votre MVP, "
            f"2) Creer un prototype (papier ou Figma) et le tester avec 5-10 utilisateurs reels, "
            f"3) Iterer en 2 semaines de sprints. "
            f"L'objectif est de valider vos hypotheses avant d'investir massivement."
        )

    if any(mot in q for mot in ("juridique", "legal", "societe", "statut", "sas", "sarl")):
        return (
            f"Pour la structure juridique de « {titre} », "
            f"la SAS est souvent recommandee pour les startups (flexibilite, levee de fonds facile). "
            f"La SARL convient mieux aux activites familiales ou artisanales. "
            f"Consultez un expert-comptable pour faire le bon choix selon votre CA previsionnel."
        )

    if any(mot in q for mot in ("equipe", "associe", "cofondateur", "recruter", "competence")):
        return (
            f"Pour constituer l'equipe de « {titre} », identifiez d'abord les competences manquantes "
            f"(technique, commercial, finance). Cherchez un co-fondateur complementaire — "
            f"les startups a deux fondateurs levent en moyenne 30% de plus. "
            f"Utilisez LinkedIn, les reseaux d'ecoles, ou des evenements startup."
        )

    if any(mot in q for mot in ("analyse", "forces", "faiblesses", "swot", "score")):
        if analyse:
            forces_str = ", ".join(analyse.forces[:3]) if analyse.forces else "non identifiees"
            faiblesses_str = ", ".join(analyse.faiblesses[:3]) if analyse.faiblesses else "non identifiees"
            return (
                f"Votre projet « {titre} » a un score de {analyse.score_global}/100. "
                f"Principales forces : {forces_str}. "
                f"Points a ameliorer : {faiblesses_str}. "
                f"Voulez-vous approfondir l'un de ces aspects ?"
            )
        return (
            f"Aucune analyse n'a encore ete realisee pour « {titre} ». "
            f"Lancez une analyse via l'endpoint /projets/{projet.pk}/analyser/ pour obtenir "
            f"un diagnostic complet forces/faiblesses et un score de viabilite."
        )

    # Reponse generique contextuelle
    return (
        f"Bonne question concernant « {titre} » (stade : {stade}). "
        f"En tant que co-fondateur IA, je vous conseille de : "
        f"1) Valider votre idee aupres de 10 clients potentiels cette semaine, "
        f"2) Documenter leurs retours pour affiner votre proposition de valeur, "
        f"3) Prioriser les actions selon la matrice impact/effort. "
        f"Pouvez-vous preciser votre question pour que je vous aide mieux ?"
    )
