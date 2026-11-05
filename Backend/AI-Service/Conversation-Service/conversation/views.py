"""
Vues DRF du Conversation-Service.

ViewSets :
  ConversationViewSet

Endpoints metier :
  POST /conversations/<id>/messages/   (poser une question et obtenir reponse IA)
  GET  /health/
"""
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer, ConversationListSerializer,
    MessageSerializer, EnvoyerMessageSerializer,
)
from .services import projet_client, market_client, llm, regles

logger = logging.getLogger(__name__)

# ── Health check ──────────────────────────────────────────────────────────────

@extend_schema(
    summary="Health check",
    responses={200: {"type": "object"}, 503: {"type": "object"}},
)
@api_view(["GET"])
def health_check(request):
    """Retourne {"status": "UP"} avec un check DB leger."""
    from django.db import connection, OperationalError

    db_status = "UP"
    try:
        connection.ensure_connection()
    except OperationalError:
        db_status = "DOWN"

    if db_status == "DOWN":
        return Response(
            {"status": "DOWN", "service": "conversation-service", "database": db_status},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"status": "UP", "service": "conversation-service", "database": db_status})

# ── Conversation ──────────────────────────────────────────────────────────────

class ConversationViewSet(viewsets.ModelViewSet):
    """CRUD des conversations. Filtre : ?projet="""
    queryset = Conversation.objects.all()

    def get_serializer_class(self):
        return ConversationListSerializer if self.action == "list" else ConversationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        projet = self.request.query_params.get("projet")
        if projet:
            qs = qs.filter(projet_id=projet)
        return qs

    @extend_schema(
        summary="Envoyer un message et obtenir une reponse IA",
        request=EnvoyerMessageSerializer,
        responses={201: MessageSerializer(many=True)},
    )
    @action(detail=True, methods=["post"], url_path="messages")
    def envoyer_message(self, request, pk=None):
        """
        POST /conversations/<id>/messages/
        Enregistre la question, genere la reponse IA, retourne les deux messages.
        """
        conversation = self.get_object()
        serializer = EnvoyerMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        contenu = serializer.validated_data["contenu"]
        pid = conversation.projet_id

        # Enregistrer le message utilisateur
        msg_user = Message.objects.create(
            conversation=conversation, role=Message.Role.UTILISATEUR, contenu=contenu
        )

        # Construire l'historique (10 derniers messages)
        historique = list(
            conversation.messages.exclude(pk=msg_user.pk)
            .order_by("-date_creation")[:10]
            .values("role", "contenu")
        )
        historique.reverse()

        # Donnees du projet et analyse depuis Projet-Service
        projet_data = projet_client.recuperer_projet(pid)
        analyse_data = projet_client.recuperer_derniere_analyse(pid)
        donnees_marche = market_client.recuperer_donnees_marche(pid)

        # Tentative LLM, repli sur les regles
        reponse = llm.repondre_chat_llm(contenu, projet_data, historique, analyse_data, donnees_marche)
        if not reponse:
            reponse = regles.repondre_chat(contenu, projet_data, historique, analyse_data, donnees_marche)

        msg_assistant = Message.objects.create(
            conversation=conversation, role=Message.Role.ASSISTANT, contenu=reponse
        )

        conversation.save(update_fields=["date_mise_a_jour"])

        return Response(
            MessageSerializer([msg_user, msg_assistant], many=True).data,
            status=status.HTTP_201_CREATED,
        )

