"""Serialiseurs DRF pour l'application projet."""
from rest_framework import serializers
from .models import Projet, AnalyseProjet


class AnalyseProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyseProjet
        fields = [
            "id", "projet", "forces", "faiblesses", "score_global",
            "resume", "source", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class ProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projet
        fields = [
            "id", "entrepreneur_id", "titre", "idee", "objectifs", "secteur",
            "stade", "public_cible", "budget_estime", "statut",
            "date_creation", "date_mise_a_jour",
        ]
        read_only_fields = ["id", "date_creation", "date_mise_a_jour"]


class ProjetListSerializer(serializers.ModelSerializer):
    """Liste allegee."""
    class Meta:
        model = Projet
        fields = [
            "id", "entrepreneur_id", "titre", "secteur", "stade", "statut",
            "date_creation", "date_mise_a_jour",
        ]

