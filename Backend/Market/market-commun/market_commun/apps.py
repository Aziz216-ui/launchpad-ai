from django.apps import AppConfig


class MarketCommunConfig(AppConfig):
    name = "market_commun"
    verbose_name = "Market (commun)"

    def ready(self):
        # Enregistrement Eureka : uniquement si EUREKA_ENABLED=true et si le processus
        # est le serveur (runserver / gunicorn), voir eureka.est_un_serveur
        from . import eureka

        eureka.demarrer()
