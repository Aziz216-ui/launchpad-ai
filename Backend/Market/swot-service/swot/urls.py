"""Routes du swot-service (préfixe /api/market/), identiques à l'ancien Market-Service."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False  # /api/market/ est partagé entre les 4 services
router.register("swot", views.ElementSWOTViewSet, basename="swot")

urlpatterns = [
    # Avant le routeur : "health" ne doit pas être pris pour un id d'élément
    path("swot/health/", views.HealthView.as_view(), name="health"),
    # Routée vers SWOT-SERVICE par la gateway (/api/market/etudes/*/generer-swot/**)
    path("etudes/<int:etude_id>/generer-swot/", views.GenererSwotView.as_view(), name="etude-generer-swot"),
    path("", include(router.urls)),
]
