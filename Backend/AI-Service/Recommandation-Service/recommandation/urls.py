"""URLs de l'application recommandation — montees sous /api/ai/ dans config/urls.py."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RecommandationViewSet, health_check

router = DefaultRouter()
router.register(r"recommandations", RecommandationViewSet, basename="recommandation")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health_check, name="health-check"),
]

