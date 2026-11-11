"""
Modèles de l'etude-service : EtudeMarche et Persona.

Persona reste liée à EtudeMarche par une clé étrangère (même service, même base).
Les secteurs, concurrents et tendances appartiennent à d'autres services : on ne stocke
que leurs identifiants (secteur_id, concurrent_ids, tendance_ids), vérifiés par appel REST
et tenus à jour par les événements RabbitMQ secteur.supprime et concurrent.supprime (handlers.py).
Les projets et utilisateurs sont gérés par d'autres microservices (projet_id, entrepreneur_id).
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class EtudeMarche(models.Model):
    """Étude de marché réalisée pour un projet (projet géré par un autre service)."""

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        FINALISEE = "finalisee", "Finalisée"

    projet_id = models.PositiveIntegerField(db_index=True)  # pas de FK : autre microservice
    # Entrepreneur propriétaire : identifiant Keycloak (claim "sub" du jeton transmis par la gateway),
    # fixé à la création. Pas de FK ; nullable pour les études créées sans jeton (appels internes).
    entrepreneur_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.BROUILLON)
    # Pas de FK : SECTEUR-SERVICE. null : secteur supprimé (événement secteur.supprime)
    secteur_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    titre = models.CharField(max_length=200)
    hypotheses = models.TextField(blank=True)
    # Offre de l'entrepreneur, comparée aux prix des concurrents
    description_offre = models.TextField(blank=True)
    prix_propose = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    # Concurrents (CONCURRENT-SERVICE) et tendances (SECTEUR-SERVICE) retenus pour CETTE étude
    concurrent_ids = models.JSONField(default=list, blank=True)
    tendance_ids = models.JSONField(default=list, blank=True)
    # Taille du marché (valeur monétaire)
    taille_marche = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    # Taux de croissance annuel en % (peut être négatif)
    taux_croissance = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0"))
    cible = models.TextField(blank=True)
    zone_geographique = models.CharField(max_length=150, blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_mise_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_creation"]
        verbose_name = "étude de marché"
        verbose_name_plural = "études de marché"

    def __str__(self):
        return f"{self.titre} (projet {self.projet_id})"


class Persona(models.Model):
    """Client type visé par l'offre d'une étude de marché."""

    etude = models.ForeignKey(EtudeMarche, on_delete=models.CASCADE, related_name="personas")
    nom = models.CharField(max_length=150)
    tranche_age = models.CharField(max_length=50, blank=True)
    profession = models.CharField(max_length=150, blank=True)
    localisation = models.CharField(max_length=150, blank=True)
    # Revenu mensuel estimé (doit être >= 0)
    revenu_estime = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    besoins = models.TextField(blank=True)
    frustrations = models.TextField(blank=True)
    comportement_achat = models.TextField(blank=True)
    date_creation = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.nom} (étude {self.etude_id})"
