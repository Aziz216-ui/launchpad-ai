from django.apps import AppConfig
from django.conf import settings


class EvenementsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'market_commun.evenements'
    label = 'evenements'  # tables et migrations inchangées (evenements_evenementoutbox...)
    verbose_name = "Événements (RabbitMQ)"

    def ready(self):
        # Relais de l'outbox : seulement dans le processus serveur d'un service qui publie
        # (même règle que l'enregistrement Eureka : jamais pendant migrate, test, consume_events)
        from market_commun.eureka import est_un_serveur

        from . import relais

        if settings.EVENEMENTS_PUBLIES and est_un_serveur():
            relais.demarrer()
