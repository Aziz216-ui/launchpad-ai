"""Routes communes d'un service : admin, Swagger et schéma sous le préfixe de sa ressource, health check."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .vues import HealthView


def urls_service(ressource, urls_app):
    """
    Routes de config/urls.py : /admin/, /api/market/<ressource>/schema/ et /docs/
    (routées par la gateway), /api/market/<ressource>/health/, puis l'API métier.
    """
    prefixe = f"api/market/{ressource}/"
    return [
        path("admin/", admin.site.urls),
        path(f"{prefixe}schema/", SpectacularAPIView.as_view(), name="schema"),
        path(f"{prefixe}docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        # Avant le routeur : "health" ne doit pas être pris pour un id
        path(f"{prefixe}health/", HealthView.as_view(), name="health"),
        path("api/market/", include(urls_app)),
    ]
