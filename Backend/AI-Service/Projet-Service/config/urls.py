"""URLs racine du Projet-Service."""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("", include("django_prometheus.urls")),  # /metrics, hors préfixe (scrape Prometheus)
    path("admin/", admin.site.urls),
    path("api/ai/", include("projet.urls")),
    path("api/ai/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/ai/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

