"""Vues de l'API du secteur-service."""

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from market_commun.evenements.producteur import publier
from market_commun.filtres import PARAMETRE_IDS, filtrer_par_ids
from market_commun.vues import ServiceIndisponibleSerializer

from . import services
from .models import Secteur, Tendance
from .serializers import (
    AnalyseSecteurSerializer,
    SecteurSerializer,
    TendanceSerializer,
)


# --- CRUD ---------------------------------------------------------------------

@extend_schema(parameters=[PARAMETRE_IDS])
class SecteurViewSet(viewsets.ModelViewSet):
    """
    Secteurs d'activité.

    La suppression d'un secteur supprime ses tendances (même service) et publie l'événement
    secteur.supprime (RabbitMQ) : concurrent-service et etude-service mettent alors secteur_id
    à null pour les concurrents et études liés.
    """

    serializer_class = SecteurSerializer
    search_fields = ["nom"]

    def get_queryset(self):
        return filtrer_par_ids(Secteur.objects.all(), self.request)

    def perform_destroy(self, secteur):
        secteur_id, nom = secteur.id, secteur.nom
        secteur.delete()
        publier("secteur.supprime", {"secteur_id": secteur_id, "nom": nom})  # après le commit


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

