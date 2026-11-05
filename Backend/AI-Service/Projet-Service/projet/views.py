"""
Vues DRF du Projet-Service.

ViewSets :
  ProjetViewSet, AnalyseProjetViewSet

Endpoints metier :
  POST /projets/<id>/activer/
  POST /projets/<id>/analyser/
  GET  /health/
"""
import logging
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import Projet, AnalyseProjet
from .serializers import (
    ProjetSerializer, ProjetListSerializer,
    AnalyseProjetSerializer,
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
            {"status": "DOWN", "service": "projet-service", "database": db_status},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"status": "UP", "service": "projet-service", "database": db_status})


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

        from django.db import transaction
        from .events.publisher import publier_evenement

        with transaction.atomic():
            analyse = AnalyseProjet.objects.create(
                projet=projet,
                forces=resultat["forces"],
                faiblesses=resultat["faiblesses"],
                score_global=resultat["score_global"],
                resume=resultat["resume"],
                source=source,
            )

            # Publication asynchrone RabbitMQ après le commit (garantie du cours: jamais d'événement pour écriture annulée)
            transaction.on_commit(
                lambda: publier_evenement(
                    event="diagnostic.termine",
                    data={
                        "projet_id": projet.pk,
                        "analyse_id": analyse.pk,
                        "score_global": analyse.score_global,
                        "forces": analyse.forces,
                        "faiblesses": analyse.faiblesses,
                        "resume": analyse.resume,
                        "source": analyse.source,
                        "projet": {
                            "id": projet.pk,
                            "titre": projet.titre,
                            "nom": projet.titre,
                            "idee": projet.idee,
                            "description": projet.idee,
                            "secteur": projet.secteur,
                            "stade": projet.stade,
                            "budget": float(projet.budget_estime) if projet.budget_estime is not None else None,
                            "budget_estime": float(projet.budget_estime) if projet.budget_estime is not None else None,
                        },
                    },
                )
            )

        return Response(AnalyseProjetSerializer(analyse).data, status=status.HTTP_201_CREATED)


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

