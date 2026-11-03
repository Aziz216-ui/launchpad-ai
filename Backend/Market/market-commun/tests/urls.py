"""Routes des tests : routes communes + une vue qui appelle un service arrêté."""

from django.urls import path
from rest_framework.views import APIView

from market_commun.clients import ServiceIndisponible
from market_commun.urls import urls_service


class ServiceArreteView(APIView):
    def get(self, request):
        raise ServiceIndisponible("AUTRE-SERVICE", "connexion refusée")


urls_app = [path("panne/", ServiceArreteView.as_view(), name="panne")]

urlpatterns = urls_service("objets", (urls_app, "tests"))
