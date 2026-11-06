"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import Secteur, Tendance


@admin.register(Secteur)
class SecteurAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "date_creation")
    search_fields = ("nom",)


@admin.register(Tendance)
class TendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "secteur", "impact", "date_creation")
    list_filter = ("secteur", "impact")
    search_fields = ("titre",)
