"""
Moteur de regles pour le Recommandation-Service.
Genere des recommandations ordonnees sans LLM.
"""
from __future__ import annotations


def generer_recommandations(
    projet_data: dict,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
) -> list[dict]:
    """Genere des recommandations ordonnees pour le projet (par regles)."""
    if donnees_marche is None:
        donnees_marche = {}

    recos = []
    ordre = 1

    # Recommandation financiere
    if not projet_data.get("budget_estime"):
        recos.append({
            "categorie": "financier", "ordre": ordre,
            "titre": "Etablir un previsionnel financier",
            "description": "Realisez un business plan financier (compte de resultat, plan de tresorerie) sur 3 ans.",
            "priorite": "haute",
        })
        ordre += 1

    # Recommandation marche
    if not projet_data.get("public_cible"):
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
    if projet_data.get("stade") in ("idee", "prototype"):
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

