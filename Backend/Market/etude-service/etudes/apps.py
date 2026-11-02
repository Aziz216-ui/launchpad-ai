from django.apps import AppConfig


class EtudesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'etudes'

    def ready(self):
        # Enregistrement Eureka (voir etudes/eureka.py) : uniquement si EUREKA_ENABLED=true
        # et si le processus est le serveur (runserver / gunicorn)
        from . import eureka

        eureka.demarrer()
