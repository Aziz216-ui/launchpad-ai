"""Serialiseurs DRF pour le Recommandation-Service."""
from rest_framework import serializers
from .models import Recommandation


class RecommandationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommandation
        fields = [
            "id", "projet_id", "analyse_id", "categorie", "titre", "description",
            "priorite", "ordre", "statut", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class RecommandationStatutSerializer(serializers.Serializer):
    """Changement de statut d'une recommandation."""
    statut = serializers.ChoiceField(choices=[
        Recommandation.Statut.APPLIQUEE,
        Recommandation.Statut.IGNOREE,
    ])


class GenererRecommandationsSerializer(serializers.Serializer):
    """Corps de la requete POST /recommandations/generer/."""
    projet_id = serializers.IntegerField(min_value=1)

