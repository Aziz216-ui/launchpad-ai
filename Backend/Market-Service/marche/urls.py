"""Routes de l'application "marche" (préfixe /api/market/)."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("secteurs", views.SecteurViewSet, basename="secteur")
router.register("concurrents", views.ConcurrentViewSet, basename="concurrent")
router.register("etudes", views.EtudeMarcheViewSet, basename="etude")
router.register("tendances", views.TendanceViewSet, basename="tendance")
router.register("personas", views.PersonaViewSet, basename="persona")
router.register("swot", views.ElementSWOTViewSet, basename="swot")

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("analyse/secteur/<int:secteur_id>/", views.AnalyseSecteurView.as_view(), name="analyse-secteur"),
    path("analyse/projet/<int:projet_id>/", views.AnalyseProjetView.as_view(), name="analyse-projet"),
    path("", include(router.urls)),
]
