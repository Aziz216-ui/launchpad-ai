"""Serialiseurs DRF pour l'application cofondateur."""
from rest_framework import serializers
from .models import Projet, AnalyseProjet, Recommandation, Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "conversation", "role", "contenu", "date_creation"]
        read_only_fields = ["id", "date_creation"]


class ConversationSerializer(serializers.ModelSerializer):
    """Detail : inclut l'historique des messages."""
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "projet", "titre", "date_creation", "date_mise_a_jour", "messages"]
        read_only_fields = ["id", "date_creation", "date_mise_a_jour"]


class ConversationListSerializer(serializers.ModelSerializer):
    """Liste allegee (sans messages)."""
    class Meta:
        model = Conversation
        fields = ["id", "projet", "titre", "date_creation", "date_mise_a_jour"]


class RecommandationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommandation
        fields = [
            "id", "projet", "analyse", "categorie", "titre", "description",
            "priorite", "ordre", "statut", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class RecommandationStatutSerializer(serializers.Serializer):
    """Changement de statut d'une recommandation."""
    statut = serializers.ChoiceField(choices=[
        Recommandation.Statut.APPLIQUEE,
        Recommandation.Statut.IGNOREE,
    ])


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


class EnvoyerMessageSerializer(serializers.Serializer):
    """Corps de la requete POST /conversations/<id>/messages/."""
    contenu = serializers.CharField(min_length=1)
