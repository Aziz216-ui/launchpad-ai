"""Sérialiseurs DRF du secteur-service (formats identiques à l'ancien Market-Service)."""

from rest_framework import serializers

from .models import Secteur, Tendance


class SecteurSerializer(serializers.ModelSerializer):
    class Meta:
        model = Secteur
        fields = ["id", "nom", "description", "date_creation"]


class TendanceSerializer(serializers.ModelSerializer):
    secteur_nom = serializers.CharField(source="secteur.nom", read_only=True)
    secteur_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tendance
        fields = ["id", "titre", "secteur", "secteur_id", "secteur_nom", "description", "impact",
                  "date_creation"]


# --- Sérialiseurs de documentation de l'analyse (Swagger uniquement) ----------

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


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class ServiceIndisponibleSerializer(serializers.Serializer):
    service = serializers.CharField()
    message = serializers.CharField()
