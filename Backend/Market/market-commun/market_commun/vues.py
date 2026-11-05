"""Vues et sérialiseurs communs : health check et forme documentée des 503."""

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class ServiceIndisponibleSerializer(serializers.Serializer):
    service = serializers.CharField()
    message = serializers.CharField()


class HealthView(APIView):
    """Vérification de l'état du service (Docker, Eureka, gateway)."""

    @extend_schema(responses={200: HealthSerializer}, summary="Health check")
    def get(self, request):
        return Response({"status": "UP", "service": settings.SERVICE_NAME})
