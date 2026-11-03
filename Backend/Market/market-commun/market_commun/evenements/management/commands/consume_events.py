"""
Commande : python manage.py consume_events

Lance les consumers RabbitMQ du service (settings.EVENEMENTS_CONSOMMES) ; tourne dans
un conteneur séparé du docker-compose (ex. swot-consumer). Ctrl+C / docker stop l'arrête.
"""

from django.conf import settings
from django.core.management.base import BaseCommand

from market_commun.evenements.consommateur import consommer


class Command(BaseCommand):
    help = "Consomme les événements RabbitMQ destinés à ce service."

    def handle(self, *args, **options):
        if not settings.EVENEMENTS_CONSOMMES:
            self.stdout.write("Aucun événement consommé par ce service.")
            return
        try:
            consommer(settings.EVENEMENTS_CONSOMMES)
        except KeyboardInterrupt:
            self.stdout.write("Arrêt du consumer.")
