from django.apps import AppConfig


class SwotConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'swot'

    def ready(self):
        # Enregistrement Eureka (voir swot/eureka.py) : uniquement si EUREKA_ENABLED=true
        # et si le processus est le serveur (runserver / gunicorn)
        from . import eureka

        eureka.demarrer()
