"""Administration Django pour le Recommandation-Service."""
from django.contrib import admin
from .models import Recommandation


@admin.register(Recommandation)
class RecommandationAdmin(admin.ModelAdmin):
    list_display = ("id", "projet_id", "categorie", "titre", "priorite", "ordre", "statut")
    list_filter = ("categorie", "priorite", "statut")
    search_fields = ("titre", "description")
    readonly_fields = ("date_creation",)

