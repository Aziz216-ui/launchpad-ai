"""Vues de l'API du concurrent-service."""

from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets

from market_commun.evenements.producteur import publier
from market_commun.filtres import PARAMETRE_IDS, filtrer_par_ids
from market_commun.vues import ServiceIndisponibleSerializer

from .models import Concurrent
from .serializers import ConcurrentSerializer

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
    La suppression publie concurrent.supprime (RabbitMQ) : etude-service retire alors
    l'id du concurrent des études.
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

    def perform_destroy(self, concurrent):
        concurrent_id, secteur_id = concurrent.id, concurrent.secteur_id
        concurrent.delete()
        publier("concurrent.supprime", {"concurrent_id": concurrent_id, "secteur_id": secteur_id})

