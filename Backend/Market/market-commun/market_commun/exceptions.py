"""Gestionnaire d'exceptions DRF : service appelé injoignable -> 503 JSON."""

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .clients import ServiceIndisponible


def gestionnaire_exceptions(exc, context):
    if isinstance(exc, ServiceIndisponible):
        return Response({"service": exc.service, "message": "Service indisponible"},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return exception_handler(exc, context)
