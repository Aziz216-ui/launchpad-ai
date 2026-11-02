"""Vues de l'API du concurrent-service."""

from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from .filtres import PARAMETRE_IDS, filtrer_par_ids
from .models import Concurrent
from .serializers import ConcurrentSerializer, HealthSerializer, ServiceIndisponibleSerializer

ERREURS_ECRITURE = {503: ServiceIndisponibleSerializer}


@extend_schema(parameters=[
    OpenApiParameter("secteur", int, description="Filtrer par id de secteur"),
    OpenApiParameter("pays", str, description="Filtrer par pays (insensible à la casse)"),
    PARAMETRE_IDS,
])
@extend_schema_view(
    create=extend_schema(responses={201: ConcurrentSerializer, **ERREURS_ECRITURE}),
    update=extend_schema(responses={200: ConcurrentSerializer, **ERREURS_ECRITURE}),
    partial_update=extend_schema(responses={200: ConcurrentSerializer, **ERREURS_ECRITURE}),
)
class ConcurrentViewSet(viewsets.ModelViewSet):
    """
    Concurrents. Le secteur (secteur_id) est vérifié auprès de SECTEUR-SERVICE :
    400 "Secteur introuvable" s'il n'existe pas, 503 si le service est injoignable.
    """

    serializer_class = ConcurrentSerializer
    search_fields = ["nom"]  # ?search=<nom>
    ordering_fields = ["nom", "prix_moyen", "part_de_marche"]

    def get_queryset(self):
        queryset = filtrer_par_ids(Concurrent.objects.all(), self.request)
        secteur = self.request.query_params.get("secteur")
        pays = self.request.query_params.get("pays")
        if secteur:
            queryset = queryset.filter(secteur_id=secteur)
        if pays:
            queryset = queryset.filter(pays__iexact=pays)
        return queryset


class HealthView(APIView):
    """Vérification de l'état du service (Docker, Eureka, gateway)."""

    @extend_schema(responses={200: HealthSerializer}, summary="Health check")
    def get(self, request):
        return Response({"status": "UP", "service": settings.SERVICE_NAME})
