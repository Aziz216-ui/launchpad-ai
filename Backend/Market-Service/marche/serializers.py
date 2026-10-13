"""Sérialiseurs DRF de l'application "marche".

Les validations des modèles (part de marché entre 0 et 100, prix >= 0)
sont reprises automatiquement par les ModelSerializer.
"""

from rest_framework import serializers

from .models import Concurrent, EtudeMarche, Secteur, Tendance


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


class EtudeMarcheSerializer(serializers.ModelSerializer):
    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)

    class Meta:
        model = EtudeMarche
        fields = [
            "id", "projet_id", "secteur", "secteur_nom", "titre", "taille_marche",
            "taux_croissance", "cible", "zone_geographique", "date_creation", "date_mise_a_jour",
        ]


class TendanceSerializer(serializers.ModelSerializer):
    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)

    class Meta:
        model = Tendance
        fields = ["id", "titre", "secteur", "secteur_nom", "description", "impact", "date_creation"]


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


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()
