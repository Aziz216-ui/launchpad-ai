"""
Modeles du Conversation-Service.

Conversation : session de chat liee a un projet (projet_id sans FK).
Message : message d'une conversation (utilisateur ou assistant).
"""
from django.db import models

class Conversation(models.Model):
    """Session de chat avec le co-fondateur IA, liee a un projet."""

    projet_id = models.PositiveIntegerField(
        verbose_name="ID projet", db_index=True
    )
    titre = models.CharField(max_length=255, verbose_name="Titre")
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    date_mise_a_jour = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        ordering = ["-date_mise_a_jour"]

    def __str__(self):
        return f"Conversation « {self.titre} » — projet {self.projet_id}"

class Message(models.Model):
    """Message dans une conversation (role : utilisateur ou assistant)."""

    class Role(models.TextChoices):
        UTILISATEUR = "utilisateur", "Utilisateur"
        ASSISTANT = "assistant", "Assistant (IA)"

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages",
        verbose_name="Conversation"
    )
    role = models.CharField(
        max_length=15, choices=Role.choices, verbose_name="Role"
    )
    contenu = models.TextField(verbose_name="Contenu")
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ["date_creation"]

    def __str__(self):
        return f"[{self.get_role_display()}] {self.contenu[:60]}..."

