"""
Commande : python manage.py seed_secteurs [--reset]

Étape 1/4 du seed du marché (voir Backend/Market/seed_all.ps1) : 3 secteurs et
7 tendances, les mêmes données de démonstration que l'ancien seed_marche.
La commande peut être relancée sans créer de doublons (get_or_create).
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from secteurs.models import Secteur, Tendance

SECTEURS = [
    ("FinTech", "Services financiers numériques : paiement, néobanques, crédit."),
    ("EdTech", "Technologies pour l'éducation et la formation en ligne."),
    ("HealthTech", "Santé numérique : télémédecine, suivi patient, e-pharmacie."),
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
    help = "Insère les secteurs et tendances de démonstration (secteur-service)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset", action="store_true",
            help="Supprime tous les secteurs (et leurs tendances) avant l'insertion.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            Secteur.objects.all().delete()  # supprime les tendances en cascade
            self.stdout.write(self.style.WARNING("Données existantes supprimées."))

        secteurs = {}
        for nom, description in SECTEURS:
            secteurs[nom], _ = Secteur.objects.get_or_create(nom=nom, defaults={"description": description})

        for titre, secteur, impact, description in TENDANCES:
            Tendance.objects.get_or_create(
                titre=titre, secteur=secteurs[secteur],
                defaults={"impact": impact, "description": description},
            )

        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {Secteur.objects.count()} secteurs, {Tendance.objects.count()} tendances."
        ))
