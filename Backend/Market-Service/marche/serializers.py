"""Sérialiseurs DRF de l'application "marche".

Les validations des modèles (part de marché entre 0 et 100, prix >= 0)
sont reprises automatiquement par les ModelSerializer.
"""

from rest_framework import serializers

from .models import Concurrent, ElementSWOT, EtudeMarche, Persona, Secteur, Tendance


class SecteurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secteur
        fields = ["id", "nom", "description", "date_creation"]


class ConcurrentSerializer(serializers.ModelSerializer):
    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)

    class Meta:
        model = Concurrent
        fields = [
            "id", "nom", "secteur", "secteur_nom", "site_web", "description",
            "forces", "faiblesses", "prix_moyen", "part_de_marche", "pays", "date_creation",
        ]


class TendanceSerializer(serializers.ModelSerializer):
    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)

    class Meta:
        model = Tendance
        fields = ["id", "titre", "secteur", "secteur_nom", "description", "impact", "date_creation"]


class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = [
            "id", "etude", "nom", "tranche_age", "profession", "localisation", "revenu_estime",
            "besoins", "frustrations", "comportement_achat", "date_creation",
        ]


class ElementSWOTSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElementSWOT
        fields = ["id", "etude", "type", "description", "genere_automatiquement", "date_creation"]
        # Un élément créé via l'API est toujours une saisie manuelle
        read_only_fields = ["genere_automatiquement"]


class EtudeMarcheSerializer(serializers.ModelSerializer):
    """
    Étude de marché (liste, création, modification).

    `concurrents` et `tendances` s'écrivent et se lisent sous forme de listes d'IDs.
    `statut` ne se modifie que par POST /etudes/<id>/finaliser/.
    """

    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)
    concurrents = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Concurrent.objects.all(),
        help_text="IDs des concurrents identifiés pour cette étude.",
    )
    tendances = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=Tendance.objects.all(),
        help_text="IDs des tendances retenues pour cette étude.",
    )

    class Meta:
        model = EtudeMarche
        fields = [
            "id", "projet_id", "entrepreneur_id", "statut", "secteur", "secteur_nom", "titre",
            "taille_marche", "taux_croissance", "cible", "zone_geographique", "hypotheses",
            "description_offre", "prix_propose", "concurrents", "tendances",
            "date_creation", "date_mise_a_jour",
        ]
        read_only_fields = ["statut"]


class EtudeMarcheDetailSerializer(EtudeMarcheSerializer):
    """Détail d'une étude : ajoute les personas, la SWOT et le détail des concurrents/tendances."""

    personas = PersonaSerializer(many=True, read_only=True)
    swot = ElementSWOTSerializer(many=True, read_only=True)
    concurrents_details = ConcurrentSerializer(source="concurrents", many=True, read_only=True)
    tendances_details = TendanceSerializer(source="tendances", many=True, read_only=True)

    class Meta(EtudeMarcheSerializer.Meta):
        fields = EtudeMarcheSerializer.Meta.fields + [
            "concurrents_details", "tendances_details", "personas", "swot",
        ]


# --- Sérialiseurs de documentation des analyses (Swagger uniquement) ----------
# Ils décrivent la forme des réponses calculées dans services.py.

NIVEAUX_CONCURRENCE = [
    ("inconnu", "Inconnu (aucune étude)"),
    ("faible", "Faible"),
    ("moyen", "Moyen"),
    ("eleve", "Élevé"),
]


class ConcurrentResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    pays = serializers.CharField()
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2)
    part_de_marche = serializers.DecimalField(max_digits=5, decimal_places=2)


class TendanceResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    impact = serializers.ChoiceField(choices=Tendance.Impact.choices)


class SecteurResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()


class AnalyseSecteurSerializer(serializers.Serializer):
    secteur = SecteurResumeSerializer()
    nombre_concurrents = serializers.IntegerField()
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2)
    part_de_marche_totale = serializers.DecimalField(max_digits=7, decimal_places=2)
    top_concurrents = ConcurrentResumeSerializer(many=True)
    tendances_positives = serializers.IntegerField()
    tendances_negatives = serializers.IntegerField()
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)


class EtudeResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    secteur = serializers.CharField()
    taille_marche = serializers.DecimalField(max_digits=15, decimal_places=2)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)
    cible = serializers.CharField()
    zone_geographique = serializers.CharField()


class SecteurProjetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    nombre_concurrents = serializers.IntegerField()
    part_de_marche_cumulee = serializers.DecimalField(max_digits=7, decimal_places=2)
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    concurrents = ConcurrentResumeSerializer(many=True)
    tendances = TendanceResumeSerializer(many=True)


class AnalyseProjetSerializer(serializers.Serializer):
    projet_id = serializers.IntegerField()
    nombre_etudes = serializers.IntegerField()
    etudes = EtudeResumeSerializer(many=True)
    secteurs = SecteurProjetSerializer(many=True)
    concurrents = ConcurrentResumeSerializer(many=True)
    tendances = TendanceResumeSerializer(many=True)
    niveau_concurrence = serializers.ChoiceField(
        choices=NIVEAUX_CONCURRENCE,
        help_text="'inconnu' si le projet n'a aucune étude de marché.",
    )


POSITIONNEMENTS_PRIX = [
    ("inconnu", "Inconnu (pas de prix proposé ou aucun concurrent)"),
    ("economique", "Économique (< moyenne - 10 %)"),
    ("aligne", "Aligné (moyenne ± 10 %)"),
    ("premium", "Premium (> moyenne + 10 %)"),
]


class ComparaisonPrixSerializer(serializers.Serializer):
    etude_id = serializers.IntegerField()
    prix_propose = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    nombre_concurrents = serializers.IntegerField()
    prix_min = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    prix_max = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    ecart_moyenne_pct = serializers.DecimalField(
        max_digits=9, decimal_places=2, allow_null=True,
        help_text="Écart en % entre le prix proposé et le prix moyen des concurrents.",
    )
    positionnement = serializers.ChoiceField(choices=POSITIONNEMENTS_PRIX)
    concurrents = ConcurrentResumeSerializer(many=True, help_text="Triés par prix croissant.")


class ElementOMSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=["tendance", "concurrence", "croissance", "prix"])
    description = serializers.CharField()


class OpportunitesMenacesSerializer(serializers.Serializer):
    etude_id = serializers.IntegerField()
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)
    positionnement_prix = serializers.ChoiceField(choices=POSITIONNEMENTS_PRIX)
    opportunites = ElementOMSerializer(many=True)
    menaces = ElementOMSerializer(many=True)


class GenererSwotSerializer(serializers.Serializer):
    generes = serializers.IntegerField(help_text="Éléments générés automatiquement.")
    conserves = serializers.IntegerField(help_text="Éléments saisis à la main, conservés.")
    swot = ElementSWOTSerializer(many=True)


class RapportInfoEtudeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    projet_id = serializers.IntegerField()
    entrepreneur_id = serializers.IntegerField(allow_null=True)
    statut = serializers.ChoiceField(choices=EtudeMarche.Statut.choices)
    date_creation = serializers.DateTimeField()
    date_mise_a_jour = serializers.DateTimeField()


class MarcheCibleSerializer(serializers.Serializer):
    secteur = SecteurResumeSerializer()
    cible = serializers.CharField()
    zone_geographique = serializers.CharField()
    taille_marche = serializers.DecimalField(max_digits=15, decimal_places=2)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)


class OffreSerializer(serializers.Serializer):
    description = serializers.CharField()
    prix_propose = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class TendanceRapportSerializer(TendanceResumeSerializer):
    description = serializers.CharField()


class ConcurrentRapportSerializer(ConcurrentResumeSerializer):
    site_web = serializers.CharField()
    forces = serializers.CharField()
    faiblesses = serializers.CharField()


class PersonaRapportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    tranche_age = serializers.CharField()
    profession = serializers.CharField()
    localisation = serializers.CharField()
    revenu_estime = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    besoins = serializers.CharField()
    frustrations = serializers.CharField()
    comportement_achat = serializers.CharField()


class OpportunitesMenacesRapportSerializer(serializers.Serializer):
    opportunites = ElementOMSerializer(many=True)
    menaces = ElementOMSerializer(many=True)


class ElementSWOTRapportSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ElementSWOT.Type.choices)
    description = serializers.CharField()
    genere_automatiquement = serializers.BooleanField()


class SwotRapportSerializer(serializers.Serializer):
    source = serializers.ChoiceField(
        choices=[("enregistree", "Éléments enregistrés"),
                 ("calculee", "Aucun élément enregistré : SWOT calculée à la volée")],
    )
    forces = ElementSWOTRapportSerializer(many=True)
    faiblesses = ElementSWOTRapportSerializer(many=True)
    opportunites = ElementSWOTRapportSerializer(many=True)
    menaces = ElementSWOTRapportSerializer(many=True)


class PotentielCommercialSerializer(serializers.Serializer):
    niveau = serializers.ChoiceField(choices=[("faible", "Faible"), ("moyen", "Moyen"),
                                              ("fort", "Fort")])
    score = serializers.IntegerField()
    score_max = serializers.IntegerField()
    justification = serializers.ListField(child=serializers.CharField())
    conclusion = serializers.CharField()


class RapportEtudeSerializer(serializers.Serializer):
    etude = RapportInfoEtudeSerializer()
    marche_cible = MarcheCibleSerializer()
    hypotheses = serializers.CharField()
    offre = OffreSerializer()
    tendances = TendanceRapportSerializer(many=True)
    concurrents = ConcurrentRapportSerializer(many=True)
    comparaison_prix = ComparaisonPrixSerializer()
    personas = PersonaRapportSerializer(many=True)
    opportunites_menaces = OpportunitesMenacesRapportSerializer()
    swot = SwotRapportSerializer()
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    potentiel_commercial = PotentielCommercialSerializer()


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
