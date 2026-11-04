from django.apps import AppConfig


class ProjetConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "projet"
    verbose_name = "Projet-Service"

    def ready(self):
        from . import eureka
        eureka.register()

