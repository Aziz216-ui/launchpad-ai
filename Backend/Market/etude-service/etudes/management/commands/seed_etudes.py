"""
Commande : python manage.py seed_etudes [--ids fichier.json] [--reset]

Étape 3/4 du seed du marché (voir Backend/Market/seed_all.ps1) : les 4 études de
l'ancien seed_marche (projets 1, 2 et 3), dont deux "complètes" (entrepreneur, offre,
hypothèses, concurrents, tendances, personas). Leur SWOT est créée par seed_swot.

Les secteurs, concurrents et tendances vivent dans d'autres services : leurs ids réels sont lus
- dans le fichier --ids ({"secteurs": {...}, "concurrents": {...}, "tendances": {...}}),
  écrit par seed_all.ps1 ;
- sinon directement sur SECTEUR-SERVICE et CONCURRENT-SERVICE.
La commande peut être relancée sans créer de doublons (get_or_create).
"""

import json
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from clients import ConcurrentClient, SecteurClient, ServiceIndisponible
from etudes.models import EtudeMarche, Persona

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

# Compléments des études "complètes", indexés par (projet_id, titre)
ETUDES_COMPLETES = {
    (1, "Paiement mobile pour PME"): {
        # Entrepreneurs fictifs (pas de compte Keycloak) : ces études ne sont visibles que par l'ADMIN
        "entrepreneur_id": "101",
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
    },
    (2, "Plateforme de soutien scolaire"): {
        "entrepreneur_id": "102",
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
    },
}


def lire_ids(fichier):
    """Ids réels {"secteurs": {nom: id}, "concurrents": {nom: id}, "tendances": {titre: id}}."""
    if fichier:
        with open(fichier, encoding="utf-8-sig") as f:
            return json.load(f)
    try:
        return {
            "secteurs": {s["nom"]: s["id"] for s in SecteurClient().list()},
            "concurrents": {c["nom"]: c["id"] for c in ConcurrentClient().list()},
            "tendances": {t["titre"]: t["id"] for t in SecteurClient().tendances()},
        }
    except ServiceIndisponible as exc:
        raise CommandError(f"{exc}. Lancer d'abord seed_secteurs et seed_concurrents, ou passer --ids.")


def completer_etude(etude, donnees, ids):
    """Complète une étude de démonstration (une seule fois, si elle n'a pas d'entrepreneur)."""
    if etude.entrepreneur_id is not None:
        return
    etude.entrepreneur_id = donnees["entrepreneur_id"]
    etude.statut = donnees["statut"]
    etude.hypotheses = donnees["hypotheses"]
    etude.description_offre = donnees["description_offre"]
    etude.prix_propose = Decimal(donnees["prix_propose"])
    etude.concurrent_ids = [ids["concurrents"][nom] for nom in donnees["concurrents"]]
    etude.tendance_ids = [ids["tendances"][titre] for titre in donnees["tendances"]]
    etude.save()
    for persona in donnees["personas"]:
        Persona.objects.get_or_create(
            etude=etude, nom=persona["nom"],
            defaults={**persona, "revenu_estime": Decimal(persona["revenu_estime"])},
        )


class Command(BaseCommand):
    help = "Insère les études de marché et personas de démonstration (etude-service)."

    def add_arguments(self, parser):
        parser.add_argument("--ids", help="Fichier JSON des ids réels (secteurs, concurrents, tendances).")
        parser.add_argument("--reset", action="store_true",
                            help="Supprime toutes les études (et leurs personas) avant l'insertion.")

    @transaction.atomic
    def handle(self, *args, **options):
        ids = lire_ids(options["ids"])
        attendus = {
            "secteurs": {e[1] for e in ETUDES},
            "concurrents": {n for d in ETUDES_COMPLETES.values() for n in d["concurrents"]},
            "tendances": {t for d in ETUDES_COMPLETES.values() for t in d["tendances"]},
        }
        for cle, noms in attendus.items():
            manquants = sorted(noms - set(ids.get(cle, {})))
            if manquants:
                raise CommandError(f"{cle} introuvables : {', '.join(manquants)}. "
                                   "Lancer d'abord seed_secteurs et seed_concurrents.")

        if options["reset"]:
            EtudeMarche.objects.all().delete()
            self.stdout.write(self.style.WARNING("Données existantes supprimées."))

        for projet_id, secteur, titre, taille, croissance, cible, zone in ETUDES:
            etude, _ = EtudeMarche.objects.get_or_create(
                projet_id=projet_id,
                titre=titre,
                defaults={
                    "secteur_id": ids["secteurs"][secteur],
                    "taille_marche": Decimal(taille),
                    "taux_croissance": Decimal(croissance),
                    "cible": cible,
                    "zone_geographique": zone,
                },
            )
            if (projet_id, titre) in ETUDES_COMPLETES:
                completer_etude(etude, ETUDES_COMPLETES[(projet_id, titre)], ids)

        self.stdout.write(self.style.SUCCESS(
            f"Seed terminé : {EtudeMarche.objects.count()} études, {Persona.objects.count()} personas."
        ))
