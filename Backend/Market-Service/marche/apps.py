from django.apps import AppConfig


class MarcheConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'marche'

    def ready(self):
        # Enregistrement Eureka (voir marche/eureka.py) : uniquement si EUREKA_ENABLED=true
        # et si le processus est le serveur (runserver / gunicorn)
        from . import eureka

        eureka.demarrer()
