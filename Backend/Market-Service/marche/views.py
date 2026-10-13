"""Vues de l'API du Market-Service."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Concurrent, EtudeMarche, Secteur, Tendance
from .serializers import (
    AnalyseProjetSerializer,
    AnalyseSecteurSerializer,
    ConcurrentSerializer,
    EtudeMarcheSerializer,
    HealthSerializer,
    SecteurSerializer,
    TendanceSerializer,
)


# --- CRUD ---------------------------------------------------------------------

class SecteurViewSet(viewsets.ModelViewSet):
    queryset = Secteur.objects.all()
    serializer_class = SecteurSerializer
    search_fields = ["nom"]


@extend_schema(parameters=[
    OpenApiParameter("secteur", int, description="Filtrer par id de secteur"),
    OpenApiParameter("pays", str, description="Filtrer par pays (insensible à la casse)"),
])
class ConcurrentViewSet(viewsets.ModelViewSet):
    serializer_class = ConcurrentSerializer
    search_fields = ["nom"]  # ?search=<nom>
    ordering_fields = ["nom", "prix_moyen", "part_de_marche"]

    def get_queryset(self):
        queryset = Concurrent.objects.select_related("secteur")
        secteur = self.request.query_params.get("secteur")
        pays = self.request.query_params.get("pays")
        if secteur:
            queryset = queryset.filter(secteur_id=secteur)
        if pays:
            queryset = queryset.filter(pays__iexact=pays)
        return queryset


@extend_schema(parameters=[
    OpenApiParameter("projet_id", int, description="Filtrer par id de projet"),
])
class EtudeMarcheViewSet(viewsets.ModelViewSet):
    serializer_class = EtudeMarcheSerializer
    search_fields = ["titre"]

    def get_queryset(self):
        queryset = EtudeMarche.objects.select_related("secteur")
        projet_id = self.request.query_params.get("projet_id")
        if projet_id:
            queryset = queryset.filter(projet_id=projet_id)
        return queryset


@extend_schema(parameters=[
    OpenApiParameter("secteur", int, description="Filtrer par id de secteur"),
    OpenApiParameter("impact", str, enum=["positif", "negatif", "neutre"]),
])
class TendanceViewSet(viewsets.ModelViewSet):
    serializer_class = TendanceSerializer
    search_fields = ["titre"]

    def get_queryset(self):
        queryset = Tendance.objects.select_related("secteur")
        secteur = self.request.query_params.get("secteur")
        impact = self.request.query_params.get("impact")
        if secteur:
            queryset = queryset.filter(secteur_id=secteur)
        if impact:
            queryset = queryset.filter(impact=impact)
        return queryset


# --- Analyses -----------------------------------------------------------------

class AnalyseSecteurView(APIView):
    """Statistiques de marché pour un secteur."""

    @extend_schema(responses={200: AnalyseSecteurSerializer}, summary="Analyse d'un secteur")
    def get(self, request, secteur_id):
        secteur = get_object_or_404(Secteur, pk=secteur_id)
        return Response(services.analyser_secteur(secteur))


class AnalyseProjetView(APIView):
    """Résumé du marché pour un projet (appelé notamment par le AI-Service)."""

    @extend_schema(
        responses={200: AnalyseProjetSerializer},
        summary="Analyse du marché d'un projet",
        description=(
            "Toujours 200 : un projet sans étude renvoie des listes vides "
            "et niveau_concurrence = 'inconnu'."
        ),
    )
    def get(self, request, projet_id):
        return Response(services.analyser_projet(projet_id))


class HealthView(APIView):
    """Vérification de l'état du service (utilisé par Docker / la gateway)."""

    @extend_schema(responses={200: HealthSerializer}, summary="Health check")
    def get(self, request):
        return Response({"status": "UP", "service": "market-service"})
