"""Administration Django pour le Co-Fondateur IA."""
from django.contrib import admin
from .models import Projet, AnalyseProjet, Recommandation, Conversation, Message


class AnalyseInline(admin.TabularInline):
    model = AnalyseProjet
    extra = 0
    fields = ("source", "score_global", "resume", "date_creation")
    readonly_fields = ("date_creation",)
    show_change_link = True


class RecommandationInline(admin.TabularInline):
    model = Recommandation
    extra = 0
    fields = ("categorie", "titre", "priorite", "ordre", "statut")
    show_change_link = True


class ConversationInline(admin.TabularInline):
    model = Conversation
    extra = 0
    fields = ("titre", "date_creation")
    readonly_fields = ("date_creation",)
    show_change_link = True


@admin.register(Projet)
class ProjetAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "entrepreneur_id", "stade", "statut", "date_creation")
    list_filter = ("statut", "stade")
    search_fields = ("titre", "idee", "secteur")
    readonly_fields = ("date_creation", "date_mise_a_jour")
    inlines = [AnalyseInline, RecommandationInline, ConversationInline]


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("role", "contenu", "date_creation")
    readonly_fields = ("date_creation",)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "projet", "date_creation", "date_mise_a_jour")
    list_filter = ("projet",)
    search_fields = ("titre",)
    readonly_fields = ("date_creation", "date_mise_a_jour")
    inlines = [MessageInline]


@admin.register(AnalyseProjet)
class AnalyseProjetAdmin(admin.ModelAdmin):
    list_display = ("id", "projet", "score_global", "source", "date_creation")
    list_filter = ("source",)
    readonly_fields = ("date_creation",)


@admin.register(Recommandation)
class RecommandationAdmin(admin.ModelAdmin):
    list_display = ("id", "projet", "categorie", "titre", "priorite", "ordre", "statut")
    list_filter = ("categorie", "priorite", "statut")
    search_fields = ("titre", "description")
    readonly_fields = ("date_creation",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "role", "date_creation")
    list_filter = ("role",)
    readonly_fields = ("date_creation",)
