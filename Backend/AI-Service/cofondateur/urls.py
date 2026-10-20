"""URLs de l'application cofondateur — montees sous /api/ai/ dans config/urls.py."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProjetViewSet, ConversationViewSet, RecommandationViewSet,
    AnalyseProjetViewSet, health_check,
)

router = DefaultRouter()
router.register(r"projets", ProjetViewSet, basename="projet")
router.register(r"conversations", ConversationViewSet, basename="conversation")
router.register(r"recommandations", RecommandationViewSet, basename="recommandation")
router.register(r"analyses", AnalyseProjetViewSet, basename="analyse")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health_check, name="health-check"),
]
