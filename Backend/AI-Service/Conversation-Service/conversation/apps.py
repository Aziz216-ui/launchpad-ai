from django.apps import AppConfig

class ConversationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "conversation"
    verbose_name = "Conversation-Service"

    def ready(self):
        from . import eureka
        eureka.register()

