"""Vues de l'API du swot-service."""

from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from clients import EtudeClient, RessourceIntrouvable
from market_commun.filtres import PARAMETRE_IDS, filtrer_par_ids
from market_commun.identite import proprietaire_a_filtrer
from market_commun.vues import ServiceIndisponibleSerializer

from . import services
from .models import ElementSWOT
from .serializers import (
    ApercuSwotSerializer,
    ElementSWOTSerializer,
    GenererSwotSerializer,
)

ERREURS = {503: ServiceIndisponibleSerializer}


def etudes_visibles(request):
    """
    Ids des études de l'utilisateur connecté (jeton transmis par la gateway), lus sur
    ETUDE-SERVICE par un appel interne ?entrepreneur_id=<sub> ; None (aucune restriction)
    pour un ADMIN ou un appel interne sans jeton. Calculé une fois par requête.
    """
    if not hasattr(request, "_etudes_visibles"):
        proprietaire = proprietaire_a_filtrer(request)
        request._etudes_visibles = None if proprietaire is None else {
            etude["id"] for etude in EtudeClient().list(entrepreneur_id=proprietaire.id)
        }
    return request._etudes_visibles


def verifier_etude_visible(request, etude_id):
    """Étude d'un autre entrepreneur : 404, comme si elle n'existait pas."""
    visibles = etudes_visibles(request)
    if visibles is not None and int(etude_id) not in visibles:
        raise Http404("Étude introuvable.")


@extend_schema(parameters=[
    OpenApiParameter("etude", int, description="Filtrer par id d'étude"),
    OpenApiParameter("type", str, enum=["force", "faiblesse", "opportunite", "menace"]),
    PARAMETRE_IDS,
])
@extend_schema_view(
    create=extend_schema(responses={201: ElementSWOTSerializer, **ERREURS}),
    update=extend_schema(responses={200: ElementSWOTSerializer, **ERREURS}),
    partial_update=extend_schema(responses={200: ElementSWOTSerializer, **ERREURS}),
)
class ElementSWOTViewSet(viewsets.ModelViewSet):
    """
    Éléments SWOT. Ceux créés ici sont des saisies manuelles (genere_automatiquement = false).
    L'étude (etude_id) est vérifiée auprès d'ETUDE-SERVICE.
    """

    serializer_class = ElementSWOTSerializer

    def get_queryset(self):
        queryset = filtrer_par_ids(ElementSWOT.objects.all(), self.request)
        # Éléments des seules études de l'utilisateur (autre entrepreneur -> 404 / liste vide)
        visibles = etudes_visibles(self.request)
        if visibles is not None:
            queryset = queryset.filter(etude_id__in=visibles)
        etude = self.request.query_params.get("etude")
        type_ = self.request.query_params.get("type")
        if etude:
            queryset = queryset.filter(etude_id=etude)
        if type_:
            queryset = queryset.filter(type=type_)
        return queryset

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "etudes_visibles": etudes_visibles(self.request)}

    @extend_schema(request=None, responses={204: None},
                   summary="Supprimer la SWOT d'une étude (appelé par ETUDE-SERVICE)")
    @action(detail=False, methods=["delete"], url_path=r"etude/(?P<etude_id>\d+)", url_name="par-etude")
    def supprimer_par_etude(self, request, etude_id=None):
        verifier_etude_visible(request, etude_id)
        ElementSWOT.objects.filter(etude_id=etude_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GenererSwotView(APIView):
    """SWOT automatique d'une étude, calculée à partir des données d'ETUDE-SERVICE."""

    @extend_schema(
        request=None, responses={200: GenererSwotSerializer, **ERREURS},
        summary="Générer la SWOT automatiquement",
        description="Remplace les éléments générés automatiquement ; "
                    "les éléments saisis à la main sont conservés.",
    )
    def post(self, request, etude_id):
        verifier_etude_visible(request, etude_id)
        try:
            generes = services.generer_swot(etude_id)
        except RessourceIntrouvable:
            raise Http404("Étude introuvable.")
        swot = ElementSWOT.objects.filter(etude_id=etude_id)
        return Response({
            "generes": generes,
            "conserves": swot.filter(genere_automatiquement=False).count(),
            "swot": ElementSWOTSerializer(swot, many=True).data,
        })

    @extend_schema(
        responses={200: ApercuSwotSerializer, **ERREURS},
        summary="Aperçu de la SWOT calculée (sans enregistrement)",
        description="Utilisé par le rapport d'ETUDE-SERVICE quand l'étude n'a aucun élément SWOT.",
    )
    def get(self, request, etude_id):
        verifier_etude_visible(request, etude_id)
        try:
            elements = services.calculer_elements_swot(etude_id)
        except RessourceIntrouvable:
            raise Http404("Étude introuvable.")
        return Response({
            "etude_id": etude_id,
            "elements": [{"type": type_, "description": description} for type_, description in elements],
        })

