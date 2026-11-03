"""Administration Django : outbox et messages traités (consultation)."""

from django.contrib import admin

from .models import EvenementOutbox, MessageTraite


@admin.register(EvenementOutbox)
class EvenementOutboxAdmin(admin.ModelAdmin):
    list_display = ("id", "routing_key", "message_id", "tentatives", "date_creation", "date_envoi")
    list_filter = ("routing_key",)
    readonly_fields = ("derniere_erreur",)


@admin.register(MessageTraite)
class MessageTraiteAdmin(admin.ModelAdmin):
    list_display = ("id", "queue", "event", "message_id", "date_traitement")
    list_filter = ("queue",)
