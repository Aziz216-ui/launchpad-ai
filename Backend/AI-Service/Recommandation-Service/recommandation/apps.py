from django.apps import AppConfig


class RecommandationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "recommandation"
    verbose_name = "Recommandation-Service"

    def ready(self):
        from . import eureka  # import local pour eviter les imports circulaires
        eureka.register()

