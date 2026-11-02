"""
Commande : python manage.py seed_swot [--ids fichier.json] [--reset]

Étape 4/4 du seed du marché (voir Backend/Market/seed_all.ps1) : SWOT des deux études
"complètes" de l'ancien seed_marche (élément saisi à la main + génération automatique).

Les études vivent dans ETUDE-SERVICE : leurs ids réels sont lus
- dans le fichier --ids ({"etudes": {"1|Paiement mobile pour PME": 7, ...}}),
  écrit par seed_all.ps1 (clé "<projet_id>|<titre>") ;
- sinon directement sur ETUDE-SERVICE (Eureka ou ETUDE_SERVICE_URL).
La génération appelle ETUDE-SERVICE (prix, opportunités/menaces) : il doit être démarré.
La commande peut être relancée sans créer de doublons.
"""

import json

from django.core.management.base import BaseCommand, CommandError

from clients import EtudeClient, ServiceIndisponible
from swot.models import ElementSWOT
from swot.services import generer_swot

# Éléments saisis à la main des études "complètes", indexés par (projet_id, titre)
SWOT_MANUEL = {
    (1, "Paiement mobile pour PME"): [
        (ElementSWOT.Type.FORCE, "Équipe fondatrice issue du secteur bancaire."),
    ],
    (2, "Plateforme de soutien scolaire"): [],
}


def ids_etudes(fichier):
    """{(projet_id, titre): id réel} lu dans le fichier --ids ou sur ETUDE-SERVICE."""
    if fichier:
        with open(fichier, encoding="utf-8-sig") as f:
            etudes = json.load(f)["etudes"]
        return {(int(cle.split("|", 1)[0]), cle.split("|", 1)[1]): id for cle, id in etudes.items()}
    try:
        return {(e["projet_id"], e["titre"]): e["id"] for e in EtudeClient().list()}
    except ServiceIndisponible as exc:
        raise CommandError(f"{exc}. Lancer d'abord seed_etudes, ou passer --ids.")


class Command(BaseCommand):
    help = "Insère la SWOT de démonstration (swot-service)."

    def add_arguments(self, parser):
        parser.add_argument("--ids", help="Fichier JSON des ids réels ({\"etudes\": {...}}).")
        parser.add_argument("--reset", action="store_true",
                            help="Supprime tous les éléments SWOT avant l'insertion.")

    def handle(self, *args, **options):
        etudes = ids_etudes(options["ids"])
        manquantes = [f"{p}|{t}" for p, t in SWOT_MANUEL if (p, t) not in etudes]
        if manquantes:
            raise CommandError(f"Études introuvables : {', '.join(manquantes)}. Lancer d'abord seed_etudes.")

        if options["reset"]:
            ElementSWOT.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données existantes supprimées."))

        for cle, manuels in SWOT_MANUEL.items():
            etude_id = etudes[cle]
            for type_, description in manuels:
                ElementSWOT.objects.get_or_create(etude_id=etude_id, type=type_, description=description)
            # Génération une seule fois (relancer POST /etudes/<id>/generer-swot/ pour la refaire)
            if not ElementSWOT.objects.filter(etude_id=etude_id, genere_automatiquement=True).exists():
                try:
                    generer_swot(etude_id)
                except ServiceIndisponible as exc:
                    raise CommandError(f"Génération de la SWOT impossible : {exc}")

        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {ElementSWOT.objects.count()} éléments SWOT "
            f"({ElementSWOT.objects.filter(genere_automatiquement=False).count()} saisis à la main)."
        ))
