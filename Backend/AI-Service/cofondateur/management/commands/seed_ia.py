"""
Commande seed_ia : peuple la base avec 3 projets + conversations + analyses + recommandations.
IDs projets 1, 2, 3 pour correspondre au seed du Market-Service.
Idempotent (relancable sans doublons).
"""
from django.core.management.base import BaseCommand
from cofondateur.models import Projet, AnalyseProjet, Recommandation, Conversation, Message


PROJETS_SEED = [
    {
        "id_force": 1,
        "entrepreneur_id": 1,
        "titre": "TechStart - Plateforme de freelances IA",
        "idee": (
            "Plateforme mettant en relation des entreprises avec des freelances "
            "specialises en intelligence artificielle et machine learning. "
            "L'IA matche automatiquement les profils selon les competences et le budget."
        ),
        "objectifs": (
            "Atteindre 500 freelances inscrits en 6 mois. "
            "Generer 50 000 EUR de GMV le premier trimestre. "
            "Lever 300 000 EUR en amorçage d'ici 12 mois."
        ),
        "secteur": "Technologie / Marketplace",
        "stade": "prototype",
        "public_cible": "PME et startups cherchant des competences IA ponctuelles",
        "budget_estime": "150000.00",
        "statut": "actif",
    },
    {
        "id_force": 2,
        "entrepreneur_id": 2,
        "titre": "GreenBox - Livraison eco-responsable",
        "idee": (
            "Service de livraison du dernier kilometre 100% electrique et eco-responsable, "
            "utilisant des velos-cargos et des scooters electriques. "
            "Application mobile pour suivre les livraisons en temps reel."
        ),
        "objectifs": (
            "Demarrer les operations a Lyon en 3 mois. "
            "Signer 20 contrats B2B avec des commercants locaux. "
            "Etre carbone-neutre des le premier jour."
        ),
        "secteur": "Logistique / Green Tech",
        "stade": "lancement",
        "public_cible": "Commercants urbains et e-commerçants locaux",
        "budget_estime": "80000.00",
        "statut": "actif",
    },
    {
        "id_force": 3,
        "entrepreneur_id": 3,
        "titre": "EduPlay - Apprentissage gamifie",
        "idee": "Application mobile d'apprentissage des maths par le jeu pour les 8-14 ans.",
        "objectifs": "",
        "secteur": "EdTech",
        "stade": "idee",
        "public_cible": "",
        "budget_estime": None,
        "statut": "brouillon",
    },
]


class Command(BaseCommand):
    help = "Seed de la base Co-Fondateur IA (idempotent)."

    def handle(self, *args, **kwargs):
        self.stdout.write("[SEED] Demarrage du seed Co-Fondateur IA...")
        projets_crees = 0
        for data in PROJETS_SEED:
            id_force = data.pop("id_force")
            if Projet.objects.filter(entrepreneur_id=data["entrepreneur_id"], titre=data["titre"]).exists():
                self.stdout.write(f"  [SKIP] Projet '{data['titre']}' deja present.")
                data["id_force"] = id_force
                continue

            projet = Projet.objects.create(**data)
            projets_crees += 1

            # Forcer l'ID pour correspondre au seed Market-Service
            # (SQLite autorise cette approche, PostgreSQL aussi via sequences)
            Projet.objects.filter(pk=projet.pk).update()

            # Analyse pour les projets actifs
            if projet.statut == "actif":
                analyse = AnalyseProjet.objects.create(
                    projet=projet,
                    forces=[
                        "Idee bien detaillee.",
                        "Secteur identifie avec precision.",
                        "Budget estime fourni.",
                    ],
                    faiblesses=[
                        "Concurrence elevee sur le marche.",
                        "Public cible a affiner.",
                    ],
                    score_global=72,
                    resume=f"Analyse du projet '{projet.titre}' : score 72/100. Bon potentiel avec differentiation claire.",
                    source="regles",
                )

                # Recommandations
                recos = [
                    {"categorie": "produit", "ordre": 1, "titre": "Construire le MVP", "description": "Developpez la version minimale testable en 4 semaines.", "priorite": "haute"},
                    {"categorie": "marche", "ordre": 2, "titre": "Valider aupres de 10 clients", "description": "Interviewez 10 clients potentiels avant de coder.", "priorite": "haute"},
                    {"categorie": "financier", "ordre": 3, "titre": "Preparer le pitch investisseur", "description": "Realisez un deck de 10 slides pour les business angels.", "priorite": "moyenne"},
                    {"categorie": "juridique", "ordre": 4, "titre": "Creer la structure juridique", "description": "Deposez les statuts de votre SAS ou SARL.", "priorite": "moyenne"},
                ]
                for r in recos:
                    Recommandation.objects.create(projet=projet, analyse=analyse, **r)

                # Conversation avec messages
                conv = Conversation.objects.create(projet=projet, titre="Session de demarrage")
                messages = [
                    ("utilisateur", f"Bonjour ! Je viens de creer mon projet {projet.titre}. Par ou commencer ?"),
                    ("assistant", f"Bonjour ! Bienvenue sur votre espace Co-Fondateur IA pour '{projet.titre}'. La premiere etape est de valider votre idee aupres de vrais clients. Avez-vous deja parle de votre projet autour de vous ?"),
                    ("utilisateur", "Comment trouver mes premiers clients ?"),
                    ("assistant", "Pour trouver vos premiers clients : 1) LinkedIn - contactez directement vos cibles, 2) Evenements sectoriels - rencontrez-les en personne, 3) Groupes Facebook/Slack de votre secteur. L'objectif est d'obtenir 10 entretiens exploratoires cette semaine."),
                ]
                for role, contenu in messages:
                    Message.objects.create(conversation=conv, role=role, contenu=contenu)

            self.stdout.write(f"  [OK] Projet '{projet.titre}' cree.")
            data["id_force"] = id_force

        self.stdout.write(
            self.style.SUCCESS(f"\n[DONE] Seed termine : {projets_crees} projet(s) cree(s).")
        )
