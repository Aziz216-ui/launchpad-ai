"""Tables locales de la messagerie : outbox (producer) et messages déjà traités (consumer)."""

from django.db import models


class EvenementOutbox(models.Model):
    """
    Événement qui n'a pas pu être publié (RabbitMQ indisponible).

    Il est renvoyé automatiquement par evenements/relais.py toutes les 10 s,
    dans l'ordre de création, avec le même message_id.
    """

    message_id = models.UUIDField(unique=True)
    routing_key = models.CharField(max_length=100)
    message = models.JSONField()
    tentatives = models.PositiveIntegerField(default=0)
    derniere_erreur = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_envoi = models.DateTimeField(null=True, blank=True, db_index=True)  # null = en attente

    class Meta:
        ordering = ["id"]
        verbose_name = "événement en attente (outbox)"
        verbose_name_plural = "événements en attente (outbox)"

    def __str__(self):
        return f"{self.routing_key} {self.message_id} ({'envoyé' if self.date_envoi else 'en attente'})"


class MessageTraite(models.Model):
    """Message déjà traité par un consumer : un message reçu deux fois n'est appliqué qu'une fois."""

    message_id = models.UUIDField()
    queue = models.CharField(max_length=100)
    event = models.CharField(max_length=100)
    date_traitement = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
        constraints = [models.UniqueConstraint(fields=["message_id", "queue"], name="message_traite_unique")]
        verbose_name = "message traité"
        verbose_name_plural = "messages traités"

    def __str__(self):
        return f"{self.queue} {self.message_id}"
