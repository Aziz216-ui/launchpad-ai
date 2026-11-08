"""URLs de l'application conversation — montees sous /api/ai/ dans config/urls.py."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, health_check

router = DefaultRouter()
router.register(r"conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("", include(router.urls)),
    path("health/", health_check, name="health-check"),
]

