"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import EtudeMarche, Persona


class PersonaInline(admin.StackedInline):
    model = Persona
    extra = 0


@admin.register(EtudeMarche)
class EtudeMarcheAdmin(admin.ModelAdmin):
    list_display = (
        "id", "titre", "projet_id", "entrepreneur_id", "statut", "secteur_id",
        "prix_propose", "taille_marche", "taux_croissance",
    )
    list_filter = ("statut", "secteur_id")
    search_fields = ("titre",)
    inlines = [PersonaInline]


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "etude", "tranche_age", "profession", "localisation")
    list_filter = ("etude",)
    search_fields = ("nom", "profession")
