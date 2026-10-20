"""
Modeles de l'application cofondateur.

1. Projet            - projet entrepreneurial (source des projets dans le monorepo)
2. AnalyseProjet     - analyse forces/faiblesses generee par l'IA
3. Recommandation    - prochaine etape conseillee
4. Conversation      - session de chat avec le co-fondateur IA
5. Message           - message d'une conversation (utilisateur ou assistant)
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

    projet = models.ForeignKey(
        Projet, on_delete=models.CASCADE, related_name="recommandations",
        verbose_name="Projet"
    )
    analyse = models.ForeignKey(
        AnalyseProjet, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="recommandations", verbose_name="Analyse associee"
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


class Conversation(models.Model):
    """Session de chat avec le co-fondateur IA, liee a un projet."""

    projet = models.ForeignKey(
        Projet, on_delete=models.CASCADE, related_name="conversations",
        verbose_name="Projet"
    )
    titre = models.CharField(max_length=255, verbose_name="Titre")
    date_creation = models.DateTimeField(auto_now_add=True, verbose_name="Cree le")
    date_mise_a_jour = models.DateTimeField(auto_now=True, verbose_name="Mis a jour le")

    class Meta:
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        ordering = ["-date_mise_a_jour"]

    def __str__(self):
        return f"Conversation « {self.titre} » — {self.projet.titre}"


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
        ordering = ["date_creation"]  # Ordre chronologique

    def __str__(self):
        return f"[{self.get_role_display()}] {self.contenu[:60]}..."
