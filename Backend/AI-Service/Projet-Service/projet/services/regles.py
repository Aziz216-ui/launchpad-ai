"""
Moteur de regles — repli complet sans cle LLM.
Fournit : analyse forces/faiblesses.
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

