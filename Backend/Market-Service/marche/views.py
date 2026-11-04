"""Vues de l'API du Market-Service."""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Concurrent, ElementSWOT, EtudeMarche, Persona, Secteur, Tendance
from .serializers import (
    AnalyseProjetSerializer,
    AnalyseSecteurSerializer,
    ComparaisonPrixSerializer,
    ConcurrentSerializer,
    ElementSWOTSerializer,
    EtudeMarcheDetailSerializer,
    EtudeMarcheSerializer,
    GenererSwotSerializer,
    HealthSerializer,
    OpportunitesMenacesSerializer,
    PersonaSerializer,
    RapportEtudeSerializer,
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
    OpenApiParameter("entrepreneur_id", int, description="Filtrer par id d'entrepreneur"),
    OpenApiParameter("statut", str, enum=["brouillon", "finalisee"]),
])
class EtudeMarcheViewSet(viewsets.ModelViewSet):
    """
    Études de marché de l'entrepreneur.

    Le détail (GET /etudes/<id>/) inclut personas, SWOT, concurrents et tendances.
    Les actions /finaliser/, /comparaison-prix/, /opportunites-menaces/, /generer-swot/,
    /rapport/ et /rapport/pdf/ portent sur une étude.
    """

    search_fields = ["titre"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EtudeMarcheDetailSerializer
        return EtudeMarcheSerializer

    def get_queryset(self):
        queryset = EtudeMarche.objects.select_related("secteur").prefetch_related(
            "concurrents", "tendances"
        )
        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                "personas", "swot", "concurrents__secteur", "tendances__secteur"
            )
        params = self.request.query_params
        for champ in ("projet_id", "entrepreneur_id", "statut"):
            valeur = params.get(champ)
            if valeur:
                queryset = queryset.filter(**{champ: valeur})
        return queryset

    @extend_schema(request=None, responses={200: EtudeMarcheDetailSerializer},
                   summary="Finaliser une étude (statut -> finalisee)")
    @action(detail=True, methods=["post"])
    def finaliser(self, request, pk=None):
        etude = self.get_object()
        if etude.statut != EtudeMarche.Statut.FINALISEE:
            etude.statut = EtudeMarche.Statut.FINALISEE
            etude.save(update_fields=["statut", "date_mise_a_jour"])
        return Response(EtudeMarcheDetailSerializer(etude).data)

    @extend_schema(responses={200: ComparaisonPrixSerializer},
                   summary="Comparer le prix proposé aux prix des concurrents")
    @action(detail=True, methods=["get"], url_path="comparaison-prix")
    def comparaison_prix(self, request, pk=None):
        return Response(services.comparer_prix(self.get_object()))

    @extend_schema(responses={200: OpportunitesMenacesSerializer},
                   summary="Opportunités et menaces de l'étude")
    @action(detail=True, methods=["get"], url_path="opportunites-menaces")
    def opportunites_menaces(self, request, pk=None):
        return Response(services.evaluer_opportunites_menaces(self.get_object()))

    @extend_schema(
        request=None, responses={200: GenererSwotSerializer},
        summary="Générer la SWOT automatiquement",
        description="Remplace les éléments générés automatiquement ; "
                    "les éléments saisis à la main sont conservés.",
    )
    @action(detail=True, methods=["post"], url_path="generer-swot")
    def generer_swot(self, request, pk=None):
        etude = self.get_object()
        generes = services.generer_swot(etude)
        swot = etude.swot.all()
        return Response({
            "generes": generes,
            "conserves": swot.filter(genere_automatiquement=False).count(),
            "swot": ElementSWOTSerializer(swot, many=True).data,
        })

    @extend_schema(responses={200: RapportEtudeSerializer},
                   summary="Rapport d'étude de marché (JSON)")
    @action(detail=True, methods=["get"])
    def rapport(self, request, pk=None):
        return Response(services.generer_rapport(self.get_object()))

    @extend_schema(
        responses={(200, "application/pdf"): OpenApiResponse(OpenApiTypes.BINARY,
                                                             description="Rapport PDF")},
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


@extend_schema(parameters=[
    OpenApiParameter("etude", int, description="Filtrer par id d'étude"),
])
class PersonaViewSet(viewsets.ModelViewSet):
    serializer_class = PersonaSerializer
    search_fields = ["nom"]

    def get_queryset(self):
        queryset = Persona.objects.all()
        etude = self.request.query_params.get("etude")
        if etude:
            queryset = queryset.filter(etude_id=etude)
        return queryset


@extend_schema(parameters=[
    OpenApiParameter("etude", int, description="Filtrer par id d'étude"),
    OpenApiParameter("type", str, enum=["force", "faiblesse", "opportunite", "menace"]),
])
class ElementSWOTViewSet(viewsets.ModelViewSet):
    """Éléments SWOT. Ceux créés ici sont des saisies manuelles (genere_automatiquement = false)."""

    serializer_class = ElementSWOTSerializer

    def get_queryset(self):
        queryset = ElementSWOT.objects.all()
        etude = self.request.query_params.get("etude")
        type_ = self.request.query_params.get("type")
        if etude:
            queryset = queryset.filter(etude_id=etude)
        if type_:
            queryset = queryset.filter(type=type_)
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
