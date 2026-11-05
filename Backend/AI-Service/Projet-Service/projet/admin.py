"""Administration Django pour le Projet-Service."""
from django.contrib import admin
from .models import Projet, AnalyseProjet


class AnalyseInline(admin.TabularInline):
    model = AnalyseProjet
    extra = 0
    fields = ("source", "score_global", "resume", "date_creation")
    readonly_fields = ("date_creation",)
    show_change_link = True


@admin.register(Projet)
class ProjetAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "entrepreneur_id", "stade", "statut", "date_creation")
    list_filter = ("statut", "stade")
    search_fields = ("titre", "idee", "secteur")
    readonly_fields = ("date_creation", "date_mise_a_jour")
    inlines = [AnalyseInline]


@admin.register(AnalyseProjet)
class AnalyseProjetAdmin(admin.ModelAdmin):
    list_display = ("id", "projet", "score_global", "source", "date_creation")
    list_filter = ("source",)
    readonly_fields = ("date_creation",)

