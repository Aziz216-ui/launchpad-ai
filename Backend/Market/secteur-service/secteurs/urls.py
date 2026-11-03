"""Routes du secteur-service (préfixe /api/market/), identiques à l'ancien Market-Service."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False  # /api/market/ est partagé entre les 4 services
router.register("secteurs", views.SecteurViewSet, basename="secteur")
router.register("tendances", views.TendanceViewSet, basename="tendance")

urlpatterns = [
    path("analyse/secteur/<int:secteur_id>/", views.AnalyseSecteurView.as_view(), name="analyse-secteur"),
    path("", include(router.urls)),
]
