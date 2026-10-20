"""URLs racine du Co-Fondateur IA."""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/ai/", include("cofondateur.urls")),
    path("api/ai/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/ai/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
