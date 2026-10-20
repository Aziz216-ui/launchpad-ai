"""
Modèles de l'application "marche".

Les projets et utilisateurs sont gérés par d'autres microservices :
on ne stocke ici que leur identifiant (projet_id), sans clé étrangère.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
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


class Concurrent(models.Model):
    """Concurrent présent dans un secteur."""

    nom = models.CharField(max_length=150)
    secteur = models.ForeignKey(Secteur, on_delete=models.CASCADE, related_name="concurrents")
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
        return f"{self.nom} ({self.secteur})"


class EtudeMarche(models.Model):
    """Étude de marché réalisée pour un projet (projet géré par un autre service)."""

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        FINALISEE = "finalisee", "Finalisée"

    projet_id = models.PositiveIntegerField(db_index=True)  # pas de FK : autre microservice
    # Entrepreneur (utilisateur du User-Service) : pas de FK, nullable pour les études existantes
    entrepreneur_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.BROUILLON)
    secteur = models.ForeignKey(Secteur, on_delete=models.CASCADE, related_name="etudes")
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
    # Concurrents et tendances retenus pour CETTE étude
    concurrents = models.ManyToManyField(Concurrent, blank=True, related_name="etudes")
    tendances = models.ManyToManyField("Tendance", blank=True, related_name="etudes")
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


class ElementSWOT(models.Model):
    """Élément de l'analyse SWOT d'une étude (saisi à la main ou généré)."""

    class Type(models.TextChoices):
        FORCE = "force", "Force"
        FAIBLESSE = "faiblesse", "Faiblesse"
        OPPORTUNITE = "opportunite", "Opportunité"
        MENACE = "menace", "Menace"

    etude = models.ForeignKey(EtudeMarche, on_delete=models.CASCADE, related_name="swot")
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
