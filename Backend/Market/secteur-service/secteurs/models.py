"""
Modèles du secteur-service : Secteur et Tendance.

Tendance reste liée à Secteur par une clé étrangère (même service, même base).
Les concurrents et études qui référencent un secteur vivent dans d'autres services :
ils ne stockent que secteur_id et l'existence est vérifiée par appel REST.
"""

from django.db import models


class Secteur(models.Model):
    """Secteur d'activité (ex : FinTech, EdTech...)."""

    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class Tendance(models.Model):
    """Tendance observée dans un secteur."""

    class Impact(models.TextChoices):
        POSITIF = "positif", "Positif"
        NEGATIF = "negatif", "Négatif"
        NEUTRE = "neutre", "Neutre"

    titre = models.CharField(max_length=200)
    secteur = models.ForeignKey(Secteur, on_delete=models.CASCADE, related_name="tendances")
    description = models.TextField(blank=True)
    impact = models.CharField(max_length=10, choices=Impact.choices, default=Impact.NEUTRE)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.titre} ({self.get_impact_display()})"
