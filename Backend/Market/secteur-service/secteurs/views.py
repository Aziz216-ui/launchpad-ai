"""Vues de l'API du secteur-service."""

from django.conf import settings
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .filtres import PARAMETRE_IDS, filtrer_par_ids
from .models import Secteur, Tendance
from .serializers import (
    AnalyseSecteurSerializer,
    HealthSerializer,
    SecteurSerializer,
    ServiceIndisponibleSerializer,
    TendanceSerializer,
)


# --- CRUD ---------------------------------------------------------------------

@extend_schema(parameters=[PARAMETRE_IDS])
class SecteurViewSet(viewsets.ModelViewSet):
    """
    Secteurs d'activité.

    La suppression d'un secteur supprime ses tendances (même service). Les concurrents et
    études des autres services qui le référencent sont conservés : ils affichent alors
    secteur_nom = null.
    """

    serializer_class = SecteurSerializer
    search_fields = ["nom"]

    def get_queryset(self):
        return filtrer_par_ids(Secteur.objects.all(), self.request)


@extend_schema(parameters=[
    OpenApiParameter("secteur", int, description="Filtrer par id de secteur"),
    OpenApiParameter("impact", str, enum=["positif", "negatif", "neutre"]),
    PARAMETRE_IDS,
])
class TendanceViewSet(viewsets.ModelViewSet):
    serializer_class = TendanceSerializer
    search_fields = ["titre"]

    def get_queryset(self):
        queryset = filtrer_par_ids(Tendance.objects.select_related("secteur"), self.request)
        secteur = self.request.query_params.get("secteur")
        impact = self.request.query_params.get("impact")
        if secteur:
            queryset = queryset.filter(secteur_id=secteur)
        if impact:
            queryset = queryset.filter(impact=impact)
        return queryset


# --- Analyse ------------------------------------------------------------------

class AnalyseSecteurView(APIView):
    """Statistiques de marché pour un secteur (concurrents lus sur CONCURRENT-SERVICE)."""

    @extend_schema(responses={200: AnalyseSecteurSerializer, 503: ServiceIndisponibleSerializer},
                   summary="Analyse d'un secteur")
    def get(self, request, secteur_id):
        secteur = get_object_or_404(Secteur, pk=secteur_id)
        return Response(services.analyser_secteur(secteur))


class HealthView(APIView):
    """Vérification de l'état du service (Docker, Eureka, gateway)."""

    @extend_schema(responses={200: HealthSerializer}, summary="Health check")
    def get(self, request):
        return Response({"status": "UP", "service": settings.SERVICE_NAME})
