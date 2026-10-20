"""
Commande : python manage.py seed_marche [--reset]

Insère des données de démonstration : 3 secteurs, 10 concurrents,
des études de marché et des tendances. Deux études sont "complètes"
(entrepreneur, offre, hypothèses, concurrents, tendances, personas, SWOT).
La commande peut être relancée sans créer de doublons (get_or_create).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from marche.models import Concurrent, ElementSWOT, EtudeMarche, Persona, Secteur, Tendance
from marche.services import generer_swot

SECTEURS = [
    ("FinTech", "Services financiers numériques : paiement, néobanques, crédit."),
    ("EdTech", "Technologies pour l'éducation et la formation en ligne."),
    ("HealthTech", "Santé numérique : télémédecine, suivi patient, e-pharmacie."),
]

# (nom, secteur, pays, prix_moyen, part_de_marche, site_web, forces, faiblesses)
CONCURRENTS = [
    ("Flouci", "FinTech", "Tunisie", "0", "18", "https://flouci.com",
     "Portefeuille mobile populaire", "Offre limitée aux particuliers"),
    ("Konnect", "FinTech", "Tunisie", "25", "12", "https://konnect.network",
     "API de paiement simple pour les e-commerçants", "Notoriété encore faible"),
    ("Stripe", "FinTech", "États-Unis", "30", "25", "https://stripe.com",
     "Écosystème très complet", "Disponibilité limitée en Afrique du Nord"),
    ("Paymee", "FinTech", "Tunisie", "20", "8", "https://paymee.tn",
     "Intégration rapide", "Peu de fonctionnalités avancées"),
    ("Coursera", "EdTech", "États-Unis", "45", "30", "https://coursera.org",
     "Partenariats universitaires", "Prix élevé pour le marché local"),
    ("GoMyCode", "EdTech", "Tunisie", "300", "10", "https://gomycode.com",
     "Bootcamps pratiques et présentiel", "Capacité limitée par campus"),
    ("OpenClassrooms", "EdTech", "France", "35", "15", "https://openclassrooms.com",
     "Parcours diplômants reconnus", "Peu de contenu en arabe"),
    ("Doctolib", "HealthTech", "France", "129", "35", "https://doctolib.fr",
     "Leader de la prise de rendez-vous", "Absent du marché tunisien"),
    ("Med.tn", "HealthTech", "Tunisie", "15", "20", "https://med.tn",
     "Annuaire médical très consulté", "Fonctionnalités de téléconsultation limitées"),
    ("Dabadoc", "HealthTech", "Maroc", "20", "10", "https://dabadoc.com",
     "Présence au Maghreb", "Faible adoption en Tunisie"),
]

# (projet_id, secteur, titre, taille_marche, taux_croissance, cible, zone)
ETUDES = [
    (1, "FinTech", "Paiement mobile pour PME", "450000000", "12.5",
     "PME et commerçants de proximité", "Tunisie"),
    (1, "HealthTech", "Paiement des consultations en ligne", "120000000", "9",
     "Cabinets médicaux privés", "Tunisie"),
    (2, "EdTech", "Plateforme de soutien scolaire", "80000000", "15",
     "Lycéens et parents", "Maghreb"),
    (3, "HealthTech", "Téléconsultation rurale", "60000000", "18",
     "Patients en zones rurales", "Tunisie"),
]

# (titre, secteur, impact, description)
TENDANCES = [
    ("Adoption massive du paiement mobile", "FinTech", "positif",
     "Hausse continue des transactions par smartphone."),
    ("Renforcement de la réglementation BCT", "FinTech", "negatif",
     "Exigences de conformité plus strictes pour les nouveaux acteurs."),
    ("Open banking", "FinTech", "neutre",
     "Ouverture progressive des API bancaires."),
    ("Apprentissage hybride", "EdTech", "positif",
     "Les écoles combinent présentiel et en ligne."),
    ("Baisse du pouvoir d'achat des ménages", "EdTech", "negatif",
     "Budgets formation réduits."),
    ("Généralisation de la téléconsultation", "HealthTech", "positif",
     "Usage accru depuis la crise sanitaire."),
    ("Protection des données de santé", "HealthTech", "negatif",
     "Contraintes fortes sur l'hébergement des données."),
]

# Compléments des études "complètes", indexés par (projet_id, titre)
ETUDES_COMPLETES = {
    (1, "Paiement mobile pour PME"): {
        "entrepreneur_id": 101,
        "statut": EtudeMarche.Statut.FINALISEE,
        "hypotheses": (
            "Les commerçants acceptent une commission si l'encaissement est instantané.\n"
            "30 % des PME du Grand Tunis équipées d'un smartphone d'ici 2 ans."
        ),
        "description_offre": (
            "Application d'encaissement par QR code pour les commerçants, "
            "avec tableau de bord des ventes."
        ),
        "prix_propose": "15",
        "concurrents": ["Flouci", "Konnect", "Paymee", "Stripe"],
        "tendances": [
            "Adoption massive du paiement mobile",
            "Renforcement de la réglementation BCT",
            "Open banking",
        ],
        "personas": [
            {
                "nom": "Sami, épicier de quartier",
                "tranche_age": "35-50 ans",
                "profession": "Gérant d'épicerie",
                "localisation": "Tunis",
                "revenu_estime": "2500",
                "besoins": "Encaisser sans manipuler d'espèces, suivre ses ventes.",
                "frustrations": "Manque de monnaie, frais des terminaux bancaires.",
                "comportement_achat": "Achète sur recommandation d'autres commerçants.",
            },
            {
                "nom": "Leila, gérante de PME",
                "tranche_age": "30-45 ans",
                "profession": "Gérante d'une boutique de prêt-à-porter",
                "localisation": "Sfax",
                "revenu_estime": "4000",
                "besoins": "Paiement en ligne et en boutique sur un seul outil.",
                "frustrations": "Délais de virement, intégration e-commerce compliquée.",
                "comportement_achat": "Compare les offres en ligne, sensible au prix.",
            },
        ],
        "swot_manuel": [
            (ElementSWOT.Type.FORCE, "Équipe fondatrice issue du secteur bancaire."),
        ],
    },
    (2, "Plateforme de soutien scolaire"): {
        "entrepreneur_id": 102,
        "statut": EtudeMarche.Statut.BROUILLON,
        "hypotheses": "Les parents paient un abonnement mensuel pour un suivi régulier.",
        "description_offre": (
            "Cours de soutien en ligne en petits groupes avec des enseignants certifiés, "
            "abonnement mensuel."
        ),
        "prix_propose": "120",
        "concurrents": ["GoMyCode", "OpenClassrooms", "Coursera"],
        "tendances": ["Apprentissage hybride", "Baisse du pouvoir d'achat des ménages"],
        "personas": [
            {
                "nom": "Nadia, mère de lycéen",
                "tranche_age": "40-50 ans",
                "profession": "Fonctionnaire",
                "localisation": "Sousse",
                "revenu_estime": "2200",
                "besoins": "Faire progresser son fils avant le baccalauréat.",
                "frustrations": "Cours particuliers chers et difficiles à organiser.",
                "comportement_achat": "Paie au mois, attentive aux résultats.",
            },
        ],
        "swot_manuel": [],
    },
}


def completer_etude(etude, donnees, concurrents, tendances):
    """Complète une étude de démonstration (une seule fois, si elle n'a pas d'entrepreneur)."""
    if etude.entrepreneur_id is not None:
        return
    etude.entrepreneur_id = donnees["entrepreneur_id"]
    etude.statut = donnees["statut"]
    etude.hypotheses = donnees["hypotheses"]
    etude.description_offre = donnees["description_offre"]
    etude.prix_propose = Decimal(donnees["prix_propose"])
    etude.save()

    etude.concurrents.set([concurrents[nom] for nom in donnees["concurrents"]])
    etude.tendances.set([tendances[titre] for titre in donnees["tendances"]])
    for persona in donnees["personas"]:
        Persona.objects.get_or_create(
            etude=etude, nom=persona["nom"],
            defaults={**persona, "revenu_estime": Decimal(persona["revenu_estime"])},
        )
    for type_, description in donnees["swot_manuel"]:
        ElementSWOT.objects.get_or_create(etude=etude, type=type_, description=description)
    generer_swot(etude)


class Command(BaseCommand):
    help = "Insère des données de test pour le Market-Service."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Supprime toutes les données du marché avant l'insertion.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            # La suppression des secteurs supprime en cascade le reste
            Secteur.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données existantes supprimées."))

        secteurs = {}
        for nom, description in SECTEURS:
            secteurs[nom], _ = Secteur.objects.get_or_create(
                nom=nom, defaults={"description": description}
            )

        concurrents = {}
        for nom, secteur, pays, prix, part, site, forces, faiblesses in CONCURRENTS:
            concurrents[nom], _ = Concurrent.objects.get_or_create(
                nom=nom,
                secteur=secteurs[secteur],
                defaults={
                    "pays": pays,
                    "prix_moyen": Decimal(prix),
                    "part_de_marche": Decimal(part),
                    "site_web": site,
                    "forces": forces,
                    "faiblesses": faiblesses,
                },
            )

        etudes = {}
        for projet_id, secteur, titre, taille, croissance, cible, zone in ETUDES:
            etudes[(projet_id, titre)], _ = EtudeMarche.objects.get_or_create(
                projet_id=projet_id,
                titre=titre,
                defaults={
                    "secteur": secteurs[secteur],
                    "taille_marche": Decimal(taille),
                    "taux_croissance": Decimal(croissance),
                    "cible": cible,
                    "zone_geographique": zone,
                },
            )

        tendances = {}
        for titre, secteur, impact, description in TENDANCES:
            tendances[titre], _ = Tendance.objects.get_or_create(
                titre=titre,
                secteur=secteurs[secteur],
                defaults={"impact": impact, "description": description},
            )

        for cle, donnees in ETUDES_COMPLETES.items():
            completer_etude(etudes[cle], donnees, concurrents, tendances)

        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {Secteur.objects.count()} secteurs, "
            f"{Concurrent.objects.count()} concurrents, "
            f"{EtudeMarche.objects.count()} études, "
            f"{Tendance.objects.count()} tendances, "
            f"{Persona.objects.count()} personas, "
            f"{ElementSWOT.objects.count()} éléments SWOT."
        ))
