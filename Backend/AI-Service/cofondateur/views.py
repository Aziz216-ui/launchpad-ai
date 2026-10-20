"""
Vues DRF du Co-Fondateur IA.

ViewSets :
  ProjetViewSet, ConversationViewSet, RecommandationViewSet, AnalyseProjetViewSet

Endpoints metier :
  POST /projets/<id>/activer/
  POST /projets/<id>/analyser/
  POST /projets/<id>/recommandations/generer/
  POST /conversations/<id>/messages/
  GET  /health/
"""
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Projet, AnalyseProjet, Recommandation, Conversation, Message
from .serializers import (
    ProjetSerializer, ProjetListSerializer,
    ConversationSerializer, ConversationListSerializer,
    RecommandationSerializer, RecommandationStatutSerializer,
    AnalyseProjetSerializer, MessageSerializer, EnvoyerMessageSerializer,
)
from .services import market_client, llm, regles

logger = logging.getLogger(__name__)


# ── Health check ──────────────────────────────────────────────────────────────

@extend_schema(
    summary="Health check",
    responses={200: {"type": "object"}, 503: {"type": "object"}},
)
@api_view(["GET"])
def health_check(request):
    """
    Retourne {"status": "UP"} avec un check DB leger.
    Jamais bloquant : timeout implicite du driver, pas d'appel LLM.
    """
    from django.db import connection, OperationalError

    db_status = "UP"
    try:
        connection.ensure_connection()
    except OperationalError:
        db_status = "DOWN"

    if db_status == "DOWN":
        return Response(
            {"status": "DOWN", "service": "cofondateur-ia", "database": db_status},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"status": "UP", "service": "cofondateur-ia", "database": db_status})


# ── Projet ─────────────────────────────────────────────────────────────────────

class ProjetViewSet(viewsets.ModelViewSet):
    """
    CRUD des projets entrepreneuriaux.
    Filtres : ?entrepreneur_id=, ?statut=
    Suppression : autorisee uniquement si statut=brouillon.
    """
    queryset = Projet.objects.all()

    def get_serializer_class(self):
        return ProjetListSerializer if self.action == "list" else ProjetSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        eid = self.request.query_params.get("entrepreneur_id")
        statut = self.request.query_params.get("statut")
        if eid:
            qs = qs.filter(entrepreneur_id=eid)
        if statut:
            qs = qs.filter(statut=statut)
        return qs

    def destroy(self, request, *args, **kwargs):
        """Suppression autorisee uniquement si statut=brouillon."""
        projet = self.get_object()
        if projet.statut != Projet.Statut.BROUILLON:
            return Response(
                {"erreur": "Impossible de supprimer un projet actif ou archive. "
                           "Seuls les brouillons peuvent etre supprimes."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @extend_schema(summary="Activer un projet", responses={200: ProjetSerializer})
    @action(detail=True, methods=["post"], url_path="activer")
    def activer(self, request, pk=None):
        """POST /projets/<id>/activer/ — passe le projet de brouillon a actif."""
        projet = self.get_object()
        projet.statut = Projet.Statut.ACTIF
        projet.save(update_fields=["statut", "date_mise_a_jour"])
        return Response(ProjetSerializer(projet).data)

    @extend_schema(
        summary="Analyser un projet (forces/faiblesses)",
        responses={201: AnalyseProjetSerializer},
    )
    @action(detail=True, methods=["post"], url_path="analyser")
    def analyser(self, request, pk=None):
        """
        POST /projets/<id>/analyser/
        Genere une AnalyseProjet avec forces, faiblesses et score.
        Enrichi par le Market-Service (si disponible).
        """
        projet = self.get_object()
        donnees_marche = market_client.recuperer_donnees_marche(projet.pk)

        # Tentative LLM, repli sur les regles
        resultat = llm.analyser_projet_llm(projet, donnees_marche)
        source = AnalyseProjet.Source.LLM if resultat else AnalyseProjet.Source.REGLES
        if resultat is None:
            resultat = regles.analyser_projet(projet, donnees_marche)

        analyse = AnalyseProjet.objects.create(
            projet=projet,
            forces=resultat["forces"],
            faiblesses=resultat["faiblesses"],
            score_global=resultat["score_global"],
            resume=resultat["resume"],
            source=source,
        )
        return Response(AnalyseProjetSerializer(analyse).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Generer les recommandations (prochaines etapes)",
        responses={201: RecommandationSerializer(many=True)},
    )
    @action(detail=True, methods=["post"], url_path="recommandations/generer")
    def generer_recommandations(self, request, pk=None):
        """
        POST /projets/<id>/recommandations/generer/
        Genere des recommandations ordonnees pour le projet.
        """
        projet = self.get_object()
        donnees_marche = market_client.recuperer_donnees_marche(projet.pk)
        analyse = projet.analyses.order_by("-date_creation").first()

        recos_data = llm.generer_recommandations_llm(projet, analyse, donnees_marche)
        if recos_data is None:
            recos_data = regles.generer_recommandations(projet, analyse, donnees_marche)

        # Supprime les anciennes recommandations non appliquees
        projet.recommandations.filter(statut=Recommandation.Statut.NOUVELLE).delete()

        recos_creees = []
        for r in recos_data:
            reco = Recommandation.objects.create(
                projet=projet,
                analyse=analyse,
                categorie=r.get("categorie", "marche"),
                titre=r.get("titre", ""),
                description=r.get("description", ""),
                priorite=r.get("priorite", "moyenne"),
                ordre=r.get("ordre", 1),
            )
            recos_creees.append(reco)

        return Response(
            RecommandationSerializer(recos_creees, many=True).data,
            status=status.HTTP_201_CREATED,
        )


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
        projet = conversation.projet

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

        # Derniere analyse disponible
        analyse = projet.analyses.order_by("-date_creation").first()
        donnees_marche = market_client.recuperer_donnees_marche(projet.pk)

        # Tentative LLM, repli sur les regles
        reponse = llm.repondre_chat_llm(contenu, projet, historique, analyse, donnees_marche)
        if not reponse:
            reponse = regles.repondre_chat(contenu, projet, historique, analyse, donnees_marche)

        msg_assistant = Message.objects.create(
            conversation=conversation, role=Message.Role.ASSISTANT, contenu=reponse
        )

        # Mettre a jour date_mise_a_jour de la conversation
        conversation.save(update_fields=["date_mise_a_jour"])

        return Response(
            MessageSerializer([msg_user, msg_assistant], many=True).data,
            status=status.HTTP_201_CREATED,
        )


# ── Recommandation ────────────────────────────────────────────────────────────

class RecommandationViewSet(viewsets.ModelViewSet):
    """
    CRUD des recommandations.
    Filtres : ?projet=, ?categorie=, ?priorite=, ?statut=
    """
    queryset = Recommandation.objects.select_related("projet", "analyse").all()
    serializer_class = RecommandationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        for filtre, champ in [
            ("projet", "projet_id"), ("categorie", "categorie"),
            ("priorite", "priorite"), ("statut", "statut"),
        ]:
            val = self.request.query_params.get(filtre)
            if val:
                qs = qs.filter(**{champ: val})
        return qs

    @extend_schema(summary="Changer le statut d'une recommandation")
    @action(detail=True, methods=["patch"], url_path="statut")
    def changer_statut(self, request, pk=None):
        """PATCH /recommandations/<id>/statut/"""
        reco = self.get_object()
        ser = RecommandationStatutSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        reco.statut = ser.validated_data["statut"]
        reco.save(update_fields=["statut"])
        return Response(RecommandationSerializer(reco).data)


# ── AnalyseProjet (lecture + suppression) ─────────────────────────────────────

class AnalyseProjetViewSet(viewsets.mixins.RetrieveModelMixin,
                           viewsets.mixins.ListModelMixin,
                           viewsets.mixins.DestroyModelMixin,
                           viewsets.GenericViewSet):
    """Lecture et suppression des analyses. Filtres : ?projet="""
    queryset = AnalyseProjet.objects.select_related("projet").all()
    serializer_class = AnalyseProjetSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        projet = self.request.query_params.get("projet")
        if projet:
            qs = qs.filter(projet_id=projet)
        return qs
