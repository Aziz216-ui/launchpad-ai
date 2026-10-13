"""
Commande : python manage.py seed_marche [--reset]

Insère des données de démonstration : 3 secteurs, 10 concurrents,
des études de marché et des tendances. La commande peut être relancée
sans créer de doublons (get_or_create).
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from marche.models import Concurrent, EtudeMarche, Secteur, Tendance

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

        for nom, secteur, pays, prix, part, site, forces, faiblesses in CONCURRENTS:
            Concurrent.objects.get_or_create(
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

        for projet_id, secteur, titre, taille, croissance, cible, zone in ETUDES:
            EtudeMarche.objects.get_or_create(
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

        for titre, secteur, impact, description in TENDANCES:
            Tendance.objects.get_or_create(
                titre=titre,
                secteur=secteurs[secteur],
                defaults={"impact": impact, "description": description},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {Secteur.objects.count()} secteurs, "
            f"{Concurrent.objects.count()} concurrents, "
            f"{EtudeMarche.objects.count()} études, "
            f"{Tendance.objects.count()} tendances."
        ))
