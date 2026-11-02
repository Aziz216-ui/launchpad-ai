"""Routes principales du swot-service."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Documentation de l'API (sous le préfixe de la ressource : routée par la gateway)
    path("api/market/swot/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/market/swot/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # API métier
    path("api/market/", include("swot.urls")),
]
