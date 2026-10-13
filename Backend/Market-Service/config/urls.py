"""Routes principales du Market-Service."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # Documentation de l'API
    path("api/market/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/market/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # API métier
    path("api/market/", include("marche.urls")),
]
