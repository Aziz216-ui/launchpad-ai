"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import Concurrent, EtudeMarche, Secteur, Tendance


@admin.register(Secteur)
class SecteurAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "date_creation")
    search_fields = ("nom",)


@admin.register(Concurrent)
class ConcurrentAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "secteur", "pays", "prix_moyen", "part_de_marche")
    list_filter = ("secteur", "pays")
    search_fields = ("nom",)


@admin.register(EtudeMarche)
class EtudeMarcheAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "projet_id", "secteur", "taille_marche", "taux_croissance")
    list_filter = ("secteur",)
    search_fields = ("titre",)


@admin.register(Tendance)
class TendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "secteur", "impact", "date_creation")
    list_filter = ("secteur", "impact")
    search_fields = ("titre",)
