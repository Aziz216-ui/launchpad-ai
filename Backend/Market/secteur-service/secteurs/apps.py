from django.apps import AppConfig


class SecteursConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'secteurs'

    def ready(self):
        # Enregistrement Eureka (voir secteurs/eureka.py) : uniquement si EUREKA_ENABLED=true
        # et si le processus est le serveur (runserver / gunicorn)
        from . import eureka

        eureka.demarrer()
