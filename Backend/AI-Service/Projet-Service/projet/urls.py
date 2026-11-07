"""URLs de l'application projet — montees sous /api/ai/ dans config/urls.py."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjetViewSet, AnalyseProjetViewSet, health_check

router = DefaultRouter()
router.register(r"projets", ProjetViewSet, basename="projet")
router.register(r"analyses", AnalyseProjetViewSet, basename="analyse")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health_check, name="health-check"),
]

