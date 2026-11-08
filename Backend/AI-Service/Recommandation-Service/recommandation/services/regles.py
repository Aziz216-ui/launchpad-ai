"""
Moteur de règles pour le Recommandation-Service.
Génère des recommandations ordonnées sans LLM en tenant compte d'ETUDE-SERVICE.
"""
from __future__ import annotations


def generer_recommandations(
    projet_data: dict,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
    donnees_finance: dict | None = None,
) -> list[dict]:
    """Génère des recommandations ordonnées pour le projet (par règles)."""
    if donnees_marche is None:
        donnees_marche = {}
    if donnees_finance is None:
        donnees_finance = {}

    recos = []
    ordre = 1

    # 1. Recommandations financières enrichies via RabbitMQ (Finance-Service)
    if donnees_finance:
        statut_ecart = (donnees_finance.get("statut") or "").upper()
        taux_marge = donnees_finance.get("taux_marge")
        titre_doc = donnees_finance.get("titre")

        if statut_ecart == "DEFICIT":
            recos.append({
                "categorie": "financier",
                "ordre": ordre,
                "titre": "Rechercher des financements d'amorçage",
                "description": "Vos prévisions actuelles présentent un déficit d'exploitation. Mobilisez des subventions BFPME, un prêt d'honneur ou des investisseurs.",
                "priorite": "haute",
            })
            ordre += 1
        elif statut_ecart == "EXCEDENT":
            recos.append({
                "categorie": "financier",
                "ordre": ordre,
                "titre": "Planifier le réinvestissement des excédents",
                "description": "Votre modèle financier est rentable. Allouez l'excédent à l'acquisition client et au recrutement commercial.",
                "priorite": "moyenne",
            })
            ordre += 1

        if taux_marge is not None:
            try:
                tm = float(taux_marge)
                if tm < 35.0:
                    recos.append({
                        "categorie": "financier",
                        "ordre": ordre,
                        "titre": "Optimiser le coût de revient",
                        "description": f"Votre marge brute ({tm:.1f}%) est serrée. Renégociez vos coûts directs auprès des fournisseurs pour préserver vos marges.",
                        "priorite": "haute" if tm < 25.0 else "moyenne",
                    })
                    ordre += 1
            except (ValueError, TypeError):
                pass

        if titre_doc:
            recos.append({
                "categorie": "financier",
                "ordre": ordre,
                "titre": f"Présenter votre {titre_doc}",
                "description": f"Le document financier '{titre_doc}' est validé. Utilisez-le comme support officiel pour vos demandes de financement bancaire.",
                "priorite": "moyenne",
            })
            ordre += 1
    elif not projet_data.get("budget_estime"):
        recos.append({
            "categorie": "financier", "ordre": ordre,
            "titre": "Établir un prévisionnel financier",
            "description": "Réalisez un business plan financier (compte de résultat, plan de trésorerie) sur 3 ans.",
            "priorite": "haute",
        })
        ordre += 1

    # 2. Recommandation marché
    if not projet_data.get("public_cible"):
        recos.append({
            "categorie": "marche", "ordre": ordre,
            "titre": "Définir le public cible",
            "description": "Identifiez votre segment client principal (âge, besoins, comportements d'achat).",
            "priorite": "haute",
        })
        ordre += 1

    # 3. Concurrence élevée (depuis ETUDE-SERVICE)
    niveau = (donnees_marche.get("niveau_concurrence") or "").lower()
    concurrents = donnees_marche.get("concurrents", [])
    nb_concurrents = len(concurrents)

    if niveau == "eleve":
        noms = ", ".join([c.get("nom", "") for c in concurrents[:2] if isinstance(c, dict)])
        desc = "Identifiez votre proposition de valeur unique (UVP) face à la concurrence élevée"
        if noms:
            desc += f" (notamment face à {noms})."
        else:
            desc += "."
        recos.append({
            "categorie": "marche", "ordre": ordre,
            "titre": "Développer une stratégie de différenciation",
            "description": desc,
            "priorite": "haute",
        })
        ordre += 1

    # 4. Tendances défavorables ou opportunités
    tendances = donnees_marche.get("tendances", [])
    tendances_negatives = [
        t.get("titre") for t in tendances
        if isinstance(t, dict) and str(t.get("impact", "")).lower() == "negatif"
    ]
    if tendances_negatives:
        recos.append({
            "categorie": "marche", "ordre": ordre,
            "titre": "Anticiper les menaces du secteur",
            "description": f"Établissez un plan d'atténuation face aux tendances défavorables identifiées : {', '.join(tendances_negatives[:2])}.",
            "priorite": "haute",
        })
        ordre += 1

    # 5. Recommandation produit
    if projet_data.get("stade") in ("idee", "prototype"):
        recos.append({
            "categorie": "produit", "ordre": ordre,
            "titre": "Construire un MVP (Produit Minimum Viable)",
            "description": "Développez une version minimale de votre produit pour valider vos hypothèses avec de vrais utilisateurs.",
            "priorite": "haute",
        })
        ordre += 1

    # 6. Recommandation juridique
    recos.append({
        "categorie": "juridique", "ordre": ordre,
        "titre": "Choisir la structure juridique",
        "description": "Consultez un expert juridique pour choisir la forme sociale (SARL, SAS...) adaptée à votre projet.",
        "priorite": "moyenne",
    })
    ordre += 1

    # 7. Recommandation équipe
    recos.append({
        "categorie": "equipe", "ordre": ordre,
        "titre": "Constituer l'équipe fondatrice",
        "description": "Identifiez les compétences manquantes et recrutez des co-fondateurs ou des premiers collaborateurs.",
        "priorite": "moyenne",
    })

    return recos
