"""Administration Django pour le Conversation-Service."""
from django.contrib import admin
from .models import Conversation, Message

class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("role", "contenu", "date_creation")
    readonly_fields = ("date_creation",)

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "titre", "projet_id", "date_creation", "date_mise_a_jour")
    list_filter = ("projet_id",)
    search_fields = ("titre",)
    readonly_fields = ("date_creation", "date_mise_a_jour")
    inlines = [MessageInline]

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "role", "date_creation")
    list_filter = ("role",)
    readonly_fields = ("date_creation",)

