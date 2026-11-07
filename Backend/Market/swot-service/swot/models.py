"""
Modèle du swot-service : ElementSWOT.

L'étude appartient à ETUDE-SERVICE : on ne stocke que son identifiant (etude_id),
sans clé étrangère. Son existence est vérifiée par appel REST (voir serializers.py).
"""

from django.db import models


class ElementSWOT(models.Model):
    """Élément de l'analyse SWOT d'une étude (saisi à la main ou généré)."""

    class Type(models.TextChoices):
        FORCE = "force", "Force"
        FAIBLESSE = "faiblesse", "Faiblesse"
        OPPORTUNITE = "opportunite", "Opportunité"
        MENACE = "menace", "Menace"

    etude_id = models.PositiveIntegerField(db_index=True)  # pas de FK : ETUDE-SERVICE
    type = models.CharField(max_length=12, choices=Type.choices)
    description = models.TextField()
    # True : créé par POST /etudes/<id>/generer-swot/ (remplacé à chaque génération)
    genere_automatiquement = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["type", "id"]
        verbose_name = "élément SWOT"
        verbose_name_plural = "éléments SWOT"

    def __str__(self):
        return f"{self.get_type_display()} : {self.description[:50]}"
