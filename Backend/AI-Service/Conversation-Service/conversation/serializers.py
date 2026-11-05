"""Serialiseurs DRF pour le Conversation-Service."""
from rest_framework import serializers
from .models import Conversation, Message

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
        fields = ["id", "projet_id", "titre", "date_creation", "date_mise_a_jour", "messages"]
        read_only_fields = ["id", "date_creation", "date_mise_a_jour"]

class ConversationListSerializer(serializers.ModelSerializer):
    """Liste allegee (sans messages)."""
    class Meta:
        model = Conversation
        fields = ["id", "projet_id", "titre", "date_creation", "date_mise_a_jour"]

class EnvoyerMessageSerializer(serializers.Serializer):
    """Corps de la requete POST /conversations/<id>/messages/."""
    contenu = serializers.CharField(min_length=1)

