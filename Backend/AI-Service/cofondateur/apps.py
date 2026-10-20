from django.apps import AppConfig


class CofondateurConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "cofondateur"
    verbose_name = "Co-Fondateur IA"

    def ready(self):
        from . import eureka  # import local pour eviter les imports circulaires
        eureka.register()
