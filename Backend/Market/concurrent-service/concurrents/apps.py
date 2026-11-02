from django.apps import AppConfig


class ConcurrentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'concurrents'

    def ready(self):
        # Enregistrement Eureka (voir concurrents/eureka.py) : uniquement si EUREKA_ENABLED=true
        # et si le processus est le serveur (runserver / gunicorn)
        from . import eureka

        eureka.demarrer()
