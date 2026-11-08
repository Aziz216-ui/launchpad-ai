"""
Moteur de règles pour le chat (Conversation-Service).
Utilise les données réelles du projet et de l'ETUDE-SERVICE.
"""
from __future__ import annotations


def repondre_chat(
    question: str,
    projet_data: dict,
    historique: list,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
) -> str:
    if donnees_marche is None:
        donnees_marche = {}

    q = question.lower()
    titre = projet_data.get("titre", "Votre projet")
    stade = projet_data.get("stade", "idée")

    if any(mot in q for mot in ("bonjour", "salut", "hello", "bonsoir")):
        return (
            f"Bonjour ! Je suis votre co-fondateur IA pour le projet « {titre} ». "
            f"Vous en êtes au stade {stade}. Comment puis-je vous aider aujourd'hui ?"
        )

    if any(mot in q for mot in ("financement", "investisseur", "levée de fonds", "levee", "argent", "budget")):
        budget = f"{projet_data.get('budget_estime')} EUR" if projet_data.get("budget_estime") else "non défini"
        return (
            f"Pour le financement de « {titre} » (budget estimé : {budget}), "
            f"je vous recommande de : 1) Finaliser votre business plan avec un prévisionnel sur 3 ans, "
            f"2) Cibler des business angels si vous êtes en pré-amorçage, "
            f"3) Explorer les aides publiques (BPI France, subventions régionales). "
            f"Voulez-vous que je détaille l'une de ces pistes ?"
        )

    if any(mot in q for mot in ("concurrent", "concurrence", "compétiteur", "competiteur", "marché", "marche")):
        niveau = donnees_marche.get("niveau_concurrence", "inconnu")
        concurrents = donnees_marche.get("concurrents", [])
        nb = len(concurrents)
        noms = ", ".join([c.get("nom", "") for c in concurrents[:3] if isinstance(c, dict)])
        rep = f"Sur le marché de « {titre} », le niveau de concurrence est évalué à : {niveau} ({nb} concurrent(s) identifié(s)"
        if noms:
            rep += f" dont {noms}). "
        else:
            rep += "). "
        rep += "Pour vous différencier : identifiez votre proposition de valeur unique (UVP), ciblez une niche et soignez votre relation client."
        return rep

    if any(mot in q for mot in ("tendance", "opportunite", "menace", "croissance")):
        tendances = donnees_marche.get("tendances", [])
        positives = [t.get("titre") for t in tendances if isinstance(t, dict) and t.get("impact") == "positif"]
        negatives = [t.get("titre") for t in tendances if isinstance(t, dict) and t.get("impact") == "negatif"]
        rep_parts = [f"Voici ce que l'étude de marché indique pour « {titre} » :"]
        if positives:
            rep_parts.append(f"- Opportunités favorables : {', '.join(positives[:2])}.")
        if negatives:
            rep_parts.append(f"- Risques / Menaces à surveiller : {', '.join(negatives[:2])}.")
        if not positives and not negatives:
            rep_parts.append("Aucune tendance majeure répertoriée pour l'instant.")
        return " ".join(rep_parts)

    if any(mot in q for mot in ("mvp", "prototype", "produit", "développer", "developper", "lancer")):
        return (
            f"Pour « {titre} » au stade {stade}, je recommande : "
            f"1) Définir les 3 fonctionnalités clés de votre MVP, "
            f"2) Créer un prototype (papier ou Figma) et le tester avec 5-10 utilisateurs cibles, "
            f"3) Itérer en cycles courts de 2 semaines. "
            f"L'objectif est de valider vos hypothèses avant d'investir massivement."
        )

    if any(mot in q for mot in ("juridique", "légal", "legal", "société", "societe", "statut", "sas", "sarl")):
        return (
            f"Pour la structure juridique de « {titre} », "
            f"la SAS est souvent recommandée pour les startups (flexibilité, levée de fonds facilitée). "
            f"La SARL convient mieux aux activités familiales ou artisanales. "
            f"Consultez un expert-comptable pour confirmer selon votre prévisionnel."
        )

    if any(mot in q for mot in ("équipe", "equipe", "associé", "associe", "cofondateur", "recruter")):
        return (
            f"Pour constituer l'équipe de « {titre} », identifiez d'abord les compétences manquantes "
            f"(technique, commercial, finance). Cherchez un co-fondateur complémentaire — "
            f"les startups à plusieurs fondateurs lèvent en moyenne davantage de fonds."
        )

    if any(mot in q for mot in ("analyse", "forces", "faiblesses", "score")):
        if analyse_data:
            forces = analyse_data.get("forces", [])
            faiblesses = analyse_data.get("faiblesses", [])
            forces_str = ", ".join(forces[:2]) if forces else "non identifiées"
            faiblesses_str = ", ".join(faiblesses[:2]) if faiblesses else "non identifiées"
            return (
                f"Votre projet « {titre} » a un score de viabilité de {analyse_data.get('score_global')}/100. "
                f"Points forts : {forces_str}. "
                f"Axes d'amélioration : {faiblesses_str}. "
                f"Voulez-vous approfondir l'un de ces aspects ?"
            )
        return (
            f"Aucune analyse n'a encore été réalisée pour « {titre} ». "
            f"Lancez une analyse de projet pour obtenir un diagnostic complet."
        )

    return (
        f"Bonne question concernant « {titre} » (stade : {stade}). "
        f"En tant que co-fondateur IA, je vous conseille de : "
        f"1) Valider votre idée auprès de 10 clients potentiels cette semaine, "
        f"2) Noter leurs retours pour affiner votre proposition de valeur, "
        f"3) Prioriser les actions selon l'impact. "
        f"Pouvez-vous préciser votre question pour que je vous aide au mieux ?"
    )
