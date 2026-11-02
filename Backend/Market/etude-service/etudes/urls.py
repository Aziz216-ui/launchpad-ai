"""Routes de l'etude-service (préfixe /api/market/), identiques à l'ancien Market-Service."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False  # /api/market/ est partagé entre les 4 services
router.register("etudes", views.EtudeMarcheViewSet, basename="etude")
router.register("personas", views.PersonaViewSet, basename="persona")

urlpatterns = [
    # Avant le routeur : "health" ne doit pas être pris pour un id d'étude
    path("etudes/health/", views.HealthView.as_view(), name="health"),
    path("analyse/projet/<int:projet_id>/", views.AnalyseProjetView.as_view(), name="analyse-projet"),
    path("", include(router.urls)),
]
