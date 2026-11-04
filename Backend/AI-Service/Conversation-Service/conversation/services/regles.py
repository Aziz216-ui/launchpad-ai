"""
Moteur de regles pour le chat (Conversation-Service).
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
    stade = projet_data.get("stade", "idee")

    if any(mot in q for mot in ("bonjour", "salut", "hello", "bonsoir")):
        return (
            f"Bonjour ! Je suis votre co-fondateur IA pour le projet « {titre} ». "
            f"Vous en etes au stade {stade}. Comment puis-je vous aider aujourd'hui ?"
        )

    if any(mot in q for mot in ("financement", "investisseur", "levee de fonds", "argent", "budget")):
        budget = f"{projet_data.get('budget_estime')} EUR" if projet_data.get("budget_estime") else "non defini"
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
        if analyse_data:
            forces = analyse_data.get("forces", [])
            faiblesses = analyse_data.get("faiblesses", [])
            forces_str = ", ".join(forces[:3]) if forces else "non identifiees"
            faiblesses_str = ", ".join(faiblesses[:3]) if faiblesses else "non identifiees"
            return (
                f"Votre projet « {titre} » a un score de {analyse_data.get('score_global')}/100. "
                f"Principales forces : {forces_str}. "
                f"Points a ameliorer : {faiblesses_str}. "
                f"Voulez-vous approfondir l'un de ces aspects ?"
            )
        return (
            f"Aucune analyse n'a encore ete realisee pour « {titre} ». "
            f"Lancez une analyse via le Projet-Service pour obtenir un diagnostic complet."
        )

    return (
        f"Bonne question concernant « {titre} » (stade : {stade}). "
        f"En tant que co-fondateur IA, je vous conseille de : "
        f"1) Valider votre idee aupres de 10 clients potentiels cette semaine, "
        f"2) Documenter leurs retours pour affiner votre proposition de valeur, "
        f"3) Prioriser les actions selon la matrice impact/effort. "
        f"Pouvez-vous preciser votre question pour que je vous aide mieux ?"
    )

