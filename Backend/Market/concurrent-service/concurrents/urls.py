"""Routes du concurrent-service (préfixe /api/market/), identiques à l'ancien Market-Service."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False  # /api/market/ est partagé entre les 4 services
router.register("concurrents", views.ConcurrentViewSet, basename="concurrent")

urlpatterns = [
    path("", include(router.urls)),
]
