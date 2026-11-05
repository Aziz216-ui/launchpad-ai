"""
Vues DRF du Recommandation-Service.

ViewSets :
  RecommandationViewSet

Endpoints metier :
  POST /recommandations/generer/        (generer des recommandations pour un projet)
  PATCH /recommandations/<id>/statut/   (changer le statut)
  GET  /health/
"""
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Recommandation
from .serializers import (
    RecommandationSerializer, RecommandationStatutSerializer,
    GenererRecommandationsSerializer,
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
            {"status": "DOWN", "service": "recommandation-service", "database": db_status},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"status": "UP", "service": "recommandation-service", "database": db_status})


# ── Recommandation ────────────────────────────────────────────────────────────

class RecommandationViewSet(viewsets.ModelViewSet):
    """
    CRUD des recommandations.
    Filtres : ?projet=, ?categorie=, ?priorite=, ?statut=
    """
    queryset = Recommandation.objects.all()
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

    @extend_schema(
        summary="Generer les recommandations pour un projet",
        request=GenererRecommandationsSerializer,
        responses={201: RecommandationSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="generer")
    def generer(self, request):
        """
        POST /recommandations/generer/
        Body : {"projet_id": <int>}
        Genere des recommandations ordonnees pour le projet.
        Appelle le Projet-Service et le Market-Service.
        """
        ser = GenererRecommandationsSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        pid = ser.validated_data["projet_id"]

        # Recuperer les donnees du projet depuis le Projet-Service
        projet_data = projet_client.recuperer_projet(pid)
        if not projet_data:
            return Response(
                {"erreur": f"Projet {pid} introuvable ou Projet-Service injoignable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Recuperer la derniere analyse depuis le Projet-Service
        analyse_data = projet_client.recuperer_derniere_analyse(pid)

        # Recuperer les donnees de marche depuis le Market-Service
        donnees_marche = market_client.recuperer_donnees_marche(pid)

        # Tentative LLM, repli sur les regles
        recos_data = llm.generer_recommandations_llm(projet_data, analyse_data, donnees_marche)
        if recos_data is None:
            recos_data = regles.generer_recommandations(projet_data, analyse_data, donnees_marche)

        # Supprime les anciennes recommandations non appliquees
        Recommandation.objects.filter(projet_id=pid, statut=Recommandation.Statut.NOUVELLE).delete()

        recos_creees = []
        for r in recos_data:
            reco = Recommandation.objects.create(
                projet_id=pid,
                analyse_id=analyse_data.get("id") if analyse_data else None,
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

