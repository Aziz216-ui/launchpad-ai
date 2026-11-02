"""Vues de l'API de l'etude-service."""

from django.conf import settings
from django.http import HttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from evenements.producteur import publier

from . import services
from .filtres import PARAMETRE_IDS, filtrer_par_ids
from .models import EtudeMarche, Persona
from .serializers import (
    AnalyseProjetSerializer,
    ComparaisonPrixSerializer,
    EtudeMarcheDetailSerializer,
    EtudeMarcheSerializer,
    HealthSerializer,
    OpportunitesMenacesSerializer,
    PersonaSerializer,
    RapportEtudeSerializer,
    ServiceIndisponibleSerializer,
)

ERREURS = {503: ServiceIndisponibleSerializer}


# --- CRUD ---------------------------------------------------------------------

@extend_schema(parameters=[
    OpenApiParameter("projet_id", int, description="Filtrer par id de projet"),
    OpenApiParameter("entrepreneur_id", int, description="Filtrer par id d'entrepreneur"),
    OpenApiParameter("statut", str, enum=["brouillon", "finalisee"]),
    PARAMETRE_IDS,
])
@extend_schema_view(
    create=extend_schema(responses={201: EtudeMarcheSerializer, **ERREURS}),
    update=extend_schema(responses={200: EtudeMarcheSerializer, **ERREURS}),
    partial_update=extend_schema(responses={200: EtudeMarcheSerializer, **ERREURS}),
    retrieve=extend_schema(responses={200: EtudeMarcheDetailSerializer, **ERREURS}),
)
class EtudeMarcheViewSet(viewsets.ModelViewSet):
    """
    Études de marché de l'entrepreneur.

    Le détail (GET /etudes/<id>/) inclut personas, SWOT (SWOT-SERVICE), concurrents
    (CONCURRENT-SERVICE) et tendances (SECTEUR-SERVICE).
    Les actions /finaliser/, /comparaison-prix/, /opportunites-menaces/, /rapport/ et
    /rapport/pdf/ portent sur une étude ; /generer-swot/ est servie par SWOT-SERVICE.

    Événements RabbitMQ publiés (après le commit) : etude.finalisee (SWOT-SERVICE génère la SWOT)
    et etude.supprimee (SWOT-SERVICE supprime la SWOT de l'étude).
    """

    search_fields = ["titre"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EtudeMarcheDetailSerializer
        return EtudeMarcheSerializer

    def get_queryset(self):
        queryset = filtrer_par_ids(EtudeMarche.objects.all(), self.request)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("personas")
        params = self.request.query_params
        for champ in ("projet_id", "entrepreneur_id", "statut"):
            valeur = params.get(champ)
            if valeur:
                queryset = queryset.filter(**{champ: valeur})
        return queryset

    def perform_destroy(self, etude):
        # Les personas sont supprimés en cascade (même base). La SWOT est dans SWOT-SERVICE :
        # elle est supprimée par son consumer à la réception de etude.supprimee (asynchrone).
        etude_id, projet_id = etude.id, etude.projet_id
        etude.delete()
        publier("etude.supprimee", {"etude_id": etude_id, "projet_id": projet_id})

    @extend_schema(request=None, responses={200: EtudeMarcheDetailSerializer, **ERREURS},
                   summary="Finaliser une étude (statut -> finalisee)",
                   description="Publie etude.finalisee : SWOT-SERVICE génère alors la SWOT de l'étude "
                               "(les éléments saisis à la main sont conservés).")
    @action(detail=True, methods=["post"])
    def finaliser(self, request, pk=None):
        etude = self.get_object()
        if etude.statut != EtudeMarche.Statut.FINALISEE:
            etude.statut = EtudeMarche.Statut.FINALISEE
            etude.save(update_fields=["statut", "date_mise_a_jour"])
            # Seulement au passage à "finalisee" (finaliser deux fois ne republie pas)
            publier("etude.finalisee", {"etude_id": etude.id, "projet_id": etude.projet_id})
        return Response(EtudeMarcheDetailSerializer(etude).data)

    @extend_schema(responses={200: ComparaisonPrixSerializer, **ERREURS},
                   summary="Comparer le prix proposé aux prix des concurrents")
    @action(detail=True, methods=["get"], url_path="comparaison-prix")
    def comparaison_prix(self, request, pk=None):
        return Response(services.comparer_prix(self.get_object()))

    @extend_schema(responses={200: OpportunitesMenacesSerializer, **ERREURS},
                   summary="Opportunités et menaces de l'étude")
    @action(detail=True, methods=["get"], url_path="opportunites-menaces")
    def opportunites_menaces(self, request, pk=None):
        return Response(services.evaluer_opportunites_menaces(self.get_object()))

    @extend_schema(responses={200: RapportEtudeSerializer, **ERREURS},
                   summary="Rapport d'étude de marché (JSON)")
    @action(detail=True, methods=["get"])
    def rapport(self, request, pk=None):
        return Response(services.generer_rapport(self.get_object()))

    @extend_schema(
        responses={(200, "application/pdf"): OpenApiResponse(OpenApiTypes.BINARY,
                                                             description="Rapport PDF"), **ERREURS},
        summary="Rapport d'étude de marché (PDF)",
    )
    @action(detail=True, methods=["get"], url_path="rapport/pdf", url_name="rapport-pdf")
    def rapport_pdf(self, request, pk=None):
        etude = self.get_object()
        pdf = services.generer_rapport_pdf(services.generer_rapport(etude))
        response = HttpResponse(pdf, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="etude-marche-{etude.id}.pdf"'
        return response


@extend_schema(parameters=[
    OpenApiParameter("etude", int, description="Filtrer par id d'étude"),
    PARAMETRE_IDS,
])
class PersonaViewSet(viewsets.ModelViewSet):
    serializer_class = PersonaSerializer
    search_fields = ["nom"]

    def get_queryset(self):
        queryset = filtrer_par_ids(Persona.objects.all(), self.request)
        etude = self.request.query_params.get("etude")
        if etude:
            queryset = queryset.filter(etude_id=etude)
        return queryset


# --- Analyse ------------------------------------------------------------------

class AnalyseProjetView(APIView):
    """Résumé du marché pour un projet (appelé notamment par le AI-Service)."""

    @extend_schema(
        responses={200: AnalyseProjetSerializer, **ERREURS},
        summary="Analyse du marché d'un projet",
        description=(
            "Toujours 200 : un projet sans étude renvoie des listes vides "
            "et niveau_concurrence = 'inconnu'. 503 seulement si un service appelé est arrêté."
        ),
    )
    def get(self, request, projet_id):
        return Response(services.analyser_projet(projet_id))


class HealthView(APIView):
    """Vérification de l'état du service (Docker, Eureka, gateway)."""

    @extend_schema(responses={200: HealthSerializer}, summary="Health check")
    def get(self, request):
        return Response({"status": "UP", "service": settings.SERVICE_NAME})
