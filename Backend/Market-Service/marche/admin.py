"""Enregistrement des modèles dans l'administration Django."""

from django.contrib import admin

from .models import Concurrent, ElementSWOT, EtudeMarche, Persona, Secteur, Tendance


@admin.register(Secteur)
class SecteurAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "date_creation")
    search_fields = ("nom",)


@admin.register(Concurrent)
class ConcurrentAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "secteur", "pays", "prix_moyen", "part_de_marche")
    list_filter = ("secteur", "pays")
    search_fields = ("nom",)


class PersonaInline(admin.StackedInline):
    model = Persona
    extra = 0


class ElementSWOTInline(admin.TabularInline):
    model = ElementSWOT
    extra = 0
    readonly_fields = ("genere_automatiquement",)


@admin.register(EtudeMarche)
class EtudeMarcheAdmin(admin.ModelAdmin):
    list_display = (
        "id", "titre", "projet_id", "entrepreneur_id", "statut", "secteur",
        "prix_propose", "taille_marche", "taux_croissance",
    )
    list_filter = ("statut", "secteur")
    search_fields = ("titre",)
    filter_horizontal = ("concurrents", "tendances")
    inlines = [PersonaInline, ElementSWOTInline]


@admin.register(Tendance)
class TendanceAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "secteur", "impact", "date_creation")
    list_filter = ("secteur", "impact")
    search_fields = ("titre",)


@admin.register(Persona)
class PersonaAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "etude", "tranche_age", "profession", "localisation")
    list_filter = ("etude",)
    search_fields = ("nom", "profession")


@admin.register(ElementSWOT)
class ElementSWOTAdmin(admin.ModelAdmin):
    list_display = ("id", "etude", "type", "description", "genere_automatiquement")
    list_filter = ("type", "genere_automatiquement", "etude")
    search_fields = ("description",)
