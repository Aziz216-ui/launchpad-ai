"""
Commande : python manage.py seed_concurrents [--ids fichier.json] [--reset]

Étape 2/4 du seed du marché (voir Backend/Market/seed_all.ps1) : les 10 concurrents
de démonstration de l'ancien seed_marche.

Les secteurs vivent dans SECTEUR-SERVICE : leurs ids réels sont lus
- dans le fichier --ids ({"secteurs": {"FinTech": 1, ...}}), écrit par seed_all.ps1 ;
- sinon directement sur SECTEUR-SERVICE (Eureka ou SECTEUR_SERVICE_URL).
La commande peut être relancée sans créer de doublons (get_or_create).
"""

import json
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from clients import SecteurClient, ServiceIndisponible
from concurrents.models import Concurrent

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


def ids_secteurs(fichier):
    """{nom du secteur: id réel} lu dans le fichier --ids ou sur SECTEUR-SERVICE."""
    if fichier:
        with open(fichier, encoding="utf-8-sig") as f:
            return json.load(f)["secteurs"]
    try:
        return {s["nom"]: s["id"] for s in SecteurClient().list()}
    except ServiceIndisponible as exc:
        raise CommandError(f"{exc}. Lancer d'abord seed_secteurs, ou passer --ids.")


class Command(BaseCommand):
    help = "Insère les concurrents de démonstration (concurrent-service)."

    def add_arguments(self, parser):
        parser.add_argument("--ids", help="Fichier JSON des ids réels ({\"secteurs\": {...}}).")
        parser.add_argument("--reset", action="store_true",
                            help="Supprime tous les concurrents avant l'insertion.")

    @transaction.atomic
    def handle(self, *args, **options):
        secteurs = ids_secteurs(options["ids"])
        manquants = sorted({c[1] for c in CONCURRENTS} - set(secteurs))
        if manquants:
            raise CommandError(f"Secteurs introuvables : {', '.join(manquants)}. Lancer d'abord seed_secteurs.")

        if options["reset"]:
            Concurrent.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données existantes supprimées."))

        for nom, secteur, pays, prix, part, site, forces, faiblesses in CONCURRENTS:
            Concurrent.objects.get_or_create(
                nom=nom,
                secteur_id=secteurs[secteur],
                defaults={
                    "pays": pays,
                    "prix_moyen": Decimal(prix),
                    "part_de_marche": Decimal(part),
                    "site_web": site,
                    "forces": forces,
                    "faiblesses": faiblesses,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Seed terminé : {Concurrent.objects.count()} concurrents."))
