"""
Modele du Recommandation-Service.

Recommandation : prochaine etape conseillee pour un projet.
Les references a Projet et AnalyseProjet sont des identifiants simples
(pas de FK — ces entites vivent dans le Projet-Service).
"""
from django.db import models


class Recommandation(models.Model):
    """Recommandation / prochaine etape conseillee pour un projet."""

    class Categorie(models.TextChoices):
        MARCHE = "marche", "Marche"
        FINANCIER = "financier", "Financier"
        JURIDIQUE = "juridique", "Juridique"
        PRODUIT = "produit", "Produit"
        EQUIPE = "equipe", "Equipe"

    class Priorite(models.TextChoices):
        HAUTE = "haute", "Haute"
        MOYENNE = "moyenne", "Moyenne"
        BASSE = "basse", "Basse"

    class Statut(models.TextChoices):
        NOUVELLE = "nouvelle", "Nouvelle"
        APPLIQUEE = "appliquee", "Appliquee"
        IGNOREE = "ignoree", "Ignoree"

    # References inter-services (pas de FK — Projet et Analyse vivent dans Projet-Service)
    projet_id = models.PositiveIntegerField(
        verbose_name="ID projet", db_index=True
    )
    analyse_id = models.PositiveIntegerField(
        verbose_name="ID analyse", null=True, blank=True
    )
    categorie = models.CharField(
        max_length=20, choices=Categorie.choices, verbose_name="Categorie"
    )
    titre = models.CharField(max_length=255, verbose_name="Titre")
    description = models.TextField(verbose_name="Description")
    priorite = models.CharField(
        max_length=10, choices=Priorite.choices, default=Priorite.MOYENNE,
        verbose_name="Priorite"
    )
    ordre = models.PositiveSmallIntegerField(
        default=1, verbose_name="Ordre (prochaine etape n°)"
    )
    statut = models.CharField(
        max_length=10, choices=Statut.choices, default=Statut.NOUVELLE,
        verbose_name="Statut"
    )
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")

    class Meta:
        verbose_name = "Recommandation"
        verbose_name_plural = "Recommandations"
        ordering = ["ordre", "priorite", "-date_creation"]

    def __str__(self):
        return f"[{self.get_categorie_display()}] {self.titre}"

