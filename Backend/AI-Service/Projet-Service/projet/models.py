"""
Modeles de l'application projet.

1. Projet            - projet entrepreneurial (source des projets dans le monorepo)
2. AnalyseProjet     - analyse forces/faiblesses generee par l'IA
"""
from django.db import models


class Projet(models.Model):
    """Projet entrepreneurial cree par un entrepreneur."""

    class Stade(models.TextChoices):
        IDEE = "idee", "Idee"
        PROTOTYPE = "prototype", "Prototype"
        LANCEMENT = "lancement", "Lancement"
        CROISSANCE = "croissance", "Croissance"

    class Statut(models.TextChoices):
        BROUILLON = "brouillon", "Brouillon"
        ACTIF = "actif", "Actif"
        ARCHIVE = "archive", "Archive"

    # Identifiant de l'entrepreneur (reference au User-Service, pas de FK)
    entrepreneur_id = models.PositiveIntegerField(
        verbose_name="ID entrepreneur", db_index=True
    )
    titre = models.CharField(max_length=255, verbose_name="Titre")
    idee = models.TextField(verbose_name="Description de l'idee", blank=True)
    objectifs = models.TextField(verbose_name="Objectifs", blank=True)
    secteur = models.CharField(max_length=100, verbose_name="Secteur", blank=True)
    # Id du secteur dans le secteur-service (domaine Etude de marche), pas de FK :
    # il doit correspondre a un secteur d'une etude de marche du projet.
    # "secteur" garde son nom pour l'affichage.
    secteur_id = models.PositiveIntegerField(
        null=True, blank=True, verbose_name="ID secteur (Etude de marche)"
    )
    stade = models.CharField(
        max_length=20, choices=Stade.choices, default=Stade.IDEE, verbose_name="Stade"
    )
    public_cible = models.TextField(verbose_name="Public cible", blank=True)
    budget_estime = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Budget estime (EUR)"
    )
    statut = models.CharField(
        max_length=20, choices=Statut.choices, default=Statut.BROUILLON,
        verbose_name="Statut", db_index=True
    )
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    date_mise_a_jour = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Projet"
        verbose_name_plural = "Projets"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"{self.titre} (entrepreneur {self.entrepreneur_id})"


class AnalyseProjet(models.Model):
    """Analyse forces/faiblesses d'un projet, generee par l'IA ou les regles."""

    class Source(models.TextChoices):
        REGLES = "regles", "Moteur de regles"
        LLM = "llm", "LLM"

    projet = models.ForeignKey(
        Projet, on_delete=models.CASCADE, related_name="analyses",
        verbose_name="Projet"
    )
    forces = models.JSONField(default=list, verbose_name="Forces (liste)")
    faiblesses = models.JSONField(default=list, verbose_name="Faiblesses (liste)")
    score_global = models.PositiveSmallIntegerField(
        verbose_name="Score global (0-100)", null=True, blank=True
    )
    resume = models.TextField(verbose_name="Resume", blank=True)
    source = models.CharField(
        max_length=10, choices=Source.choices, default=Source.REGLES,
        verbose_name="Source"
    )
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Analyse de projet"
        verbose_name_plural = "Analyses de projets"
        ordering = ["-date_creation"]

    def __str__(self):
        return f"Analyse #{self.pk} — {self.projet.titre} (score {self.score_global})"

