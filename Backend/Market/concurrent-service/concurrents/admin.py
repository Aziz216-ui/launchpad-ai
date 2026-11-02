"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import Concurrent


@admin.register(Concurrent)
class ConcurrentAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "secteur_id", "pays", "prix_moyen", "part_de_marche")
    list_filter = ("secteur_id", "pays")
    search_fields = ("nom",)
