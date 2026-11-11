"""Republie l'événement accountant.registered pour tous les comptables déjà inscrits.

Lancée à chaque démarrage du conteneur (voir Dockerfile) : rattrape les comptables inscrits avant
l'ajout de l'événement, ou pendant une indisponibilité de RabbitMQ. Sans risque de doublon :
workspace-service ne crée l'espace que s'il n'existe pas encore (voir authentication/events.py).
"""
from django.core.management.base import BaseCommand, CommandError

from authentication.events import publier_comptables
from authentication.models import User


class Command(BaseCommand):
    help = "Republie accountant.registered pour chaque comptable (création des espaces comptables manquants)."

    def handle(self, *args, **options):
        comptables = list(User.objects.filter(role=User.Role.ACCOUNTANT))
        try:
            publies = publier_comptables(comptables)
        except Exception as exc:  # noqa: BLE001
            raise CommandError(f"RabbitMQ indisponible : {exc or type(exc).__name__}") from exc
        self.stdout.write(self.style.SUCCESS(f"{publies} comptable(s) publié(s) vers workspace-service."))
