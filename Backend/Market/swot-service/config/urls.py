"""Routes principales du swot-service : routes communes (admin, Swagger, health) + API métier."""

from market_commun.urls import urls_service

urlpatterns = urls_service("swot", "swot.urls")
