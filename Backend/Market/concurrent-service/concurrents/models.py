"""
Modèle du concurrent-service : Concurrent.

Le secteur appartient à SECTEUR-SERVICE : on ne stocke que son identifiant
(secteur_id), sans clé étrangère. Son existence est vérifiée par appel REST
à la création et à la modification (voir serializers.py).
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Concurrent(models.Model):
    """Concurrent présent dans un secteur."""

    nom = models.CharField(max_length=150)
    secteur_id = models.PositiveIntegerField(db_index=True)  # pas de FK : SECTEUR-SERVICE
    site_web = models.URLField(blank=True)
    description = models.TextField(blank=True)
    forces = models.TextField(blank=True)
    faiblesses = models.TextField(blank=True)
    # Prix moyen de l'offre (doit être >= 0)
    prix_moyen = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    # Part de marché en pourcentage (entre 0 et 100)
    part_de_marche = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    pays = models.CharField(max_length=100, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-part_de_marche", "nom"]

    def __str__(self):
        return f"{self.nom} (secteur {self.secteur_id})"
