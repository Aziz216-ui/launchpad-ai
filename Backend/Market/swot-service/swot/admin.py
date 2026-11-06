"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import ElementSWOT


@admin.register(ElementSWOT)
class ElementSWOTAdmin(admin.ModelAdmin):
    list_display = ("id", "etude_id", "type", "description", "genere_automatiquement")
    list_filter = ("type", "genere_automatiquement", "etude_id")
    search_fields = ("description",)
    readonly_fields = ("genere_automatiquement",)
