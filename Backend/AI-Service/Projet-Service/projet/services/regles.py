"""
Moteur de règles pour l'analyse de projet (Projet-Service).
Fournit : analyse forces/faiblesses et score global basés sur le projet et l'ETUDE-SERVICE.
"""
from __future__ import annotations


def analyser_projet(projet, donnees_marche: dict, donnees_finance: dict | None = None) -> dict:
    """
    Analyse un projet par règles et retourne :
    - forces (list[str])
    - faiblesses (list[str])
    - score_global (int 0-100)
    - resume (str)
    """
    if donnees_finance is None:
        donnees_finance = {}

    forces = []
    faiblesses = []
    score = 50  # Base

    # --- 1. Champs du projet ---
    if projet.idee and len(projet.idee) > 50:
        forces.append("Idée bien détaillée et documentée.")
        score += 5
    else:
        faiblesses.append("L'idée manque de détail — développer la description.")
        score -= 5

    if projet.objectifs and len(projet.objectifs) > 30:
        forces.append("Objectifs clairement définis.")
        score += 5
    else:
        faiblesses.append("Les objectifs sont vagues ou absents — les formaliser.")
        score -= 10

    if projet.public_cible:
        forces.append(f"Public cible identifié : {projet.public_cible[:60]}.")
        score += 5
    else:
        faiblesses.append("Aucun public cible défini — identifier le segment client.")
        score -= 5

    if projet.budget_estime and float(projet.budget_estime) > 0:
        forces.append(f"Budget estimé fourni : {projet.budget_estime} EUR.")
        score += 5
    else:
        faiblesses.append("Aucun budget estimé — réaliser un prévisionnel financier.")
        score -= 5

    if projet.secteur:
        forces.append(f"Secteur clairement identifié : {projet.secteur}.")
        score += 3
    else:
        faiblesses.append("Secteur d'activité non précisé.")
        score -= 3

    # --- 2. Données de l'ETUDE-SERVICE ---
    niveau = (donnees_marche.get("niveau_concurrence") or "inconnu").lower()
    concurrents = donnees_marche.get("concurrents", [])
    nb_concurrents = len(concurrents)
    etudes = donnees_marche.get("etudes", [])
    nb_etudes = len(etudes)

    # Analyse du niveau de concurrence
    if niveau == "eleve":
        faiblesses.append(f"Concurrence élevée ({nb_concurrents} concurrent(s) identifié(s)) — différenciation requise.")
        score -= 10
    elif niveau == "moyen":
        faiblesses.append("Concurrence modérée — surveiller le marché.")
        score -= 5
    elif niveau == "faible":
        forces.append("Concurrence faible — opportunité de marché favorable.")
        score += 10

    # Études disponibles
    if nb_etudes > 0:
        forces.append(f"{nb_etudes} étude(s) de marché disponible(s).")
        score += 5

        # Analyse du taux de croissance et de la taille de marché
        croissance_forte = False
        for e in etudes:
            if isinstance(e, dict):
                taux = e.get("taux_croissance")
                if taux is not None:
                    try:
                        if float(taux) >= 10.0:
                            croissance_forte = True
                    except (ValueError, TypeError):
                        pass

        if croissance_forte:
            forces.append("Secteur en forte croissance (taux de croissance ≥ 10%).")
            score += 7

    # Tendances réelles du nouveau format (impact : "positif" | "negatif" | "neutre")
    tendances = donnees_marche.get("tendances", [])
    tendances_positives = [
        t.get("titre") for t in tendances
        if isinstance(t, dict) and str(t.get("impact", "")).lower() == "positif"
    ]
    tendances_negatives = [
        t.get("titre") for t in tendances
        if isinstance(t, dict) and str(t.get("impact", "")).lower() == "negatif"
    ]

    if tendances_positives:
        titres = ", ".join(tendances_positives[:2])
        forces.append(f"Tendances de marché favorables : {titres}.")
        score += 6

    if tendances_negatives:
        titres = ", ".join(tendances_negatives[:2])
        faiblesses.append(f"Tendances défavorables ou menaces identifiées : {titres}.")
        score -= 6

    # --- 3. Données de FINANCE-SERVICE ---
    if donnees_finance:
        prev = donnees_finance.get("prevision") or {}
        marges = donnees_finance.get("marges") or {}
        ecart = donnees_finance.get("ecart") or {}

        ca = prev.get("chiffreAffaires") or donnees_finance.get("chiffreAffaires")
        statut_ecart = (ecart.get("statut") or donnees_finance.get("statut") or "").upper()
        montant_ecart = ecart.get("montant") or donnees_finance.get("montant_ecart") or 0
        taux_marge = marges.get("tauxMargeBrute") or donnees_finance.get("taux_marge")

        if ca is not None:
            try:
                forces.append(f"Modèle financier établi : CA prévisionnel de {float(ca):,.0f} TND.")
                score += 5
            except (ValueError, TypeError):
                pass

        if statut_ecart == "EXCEDENT":
            forces.append("Résultat d'exploitation prévisionnel excédentaire (rentable).")
            score += 10
        elif statut_ecart == "DEFICIT":
            faiblesses.append(f"Déficit prévisionnel identifié ({abs(float(montant_ecart)):,.0f} TND) — besoin de financement.")
            score -= 10

        if taux_marge is not None:
            try:
                tm = float(taux_marge)
                if tm >= 35.0:
                    forces.append(f"Marge brute saine ({tm:.1f}%).")
                    score += 5
                elif tm > 0 and tm < 25.0:
                    faiblesses.append(f"Marge brute fragile ({tm:.1f}%), vulnérable aux coûts directs.")
                    score -= 5
            except (ValueError, TypeError):
                pass

    # Normalisation du score
    score = max(0, min(100, score))

    resume_parts = [
        f"Score de viabilité : {score}/100.",
        f"Forces identifiées : {len(forces)}. Faiblesses : {len(faiblesses)}.",
    ]
    if niveau != "inconnu":
        resume_parts.append(f"Niveau de concurrence : {niveau}.")
    resume = " ".join(resume_parts)

    return {"forces": forces, "faiblesses": faiblesses, "score_global": score, "resume": resume}
