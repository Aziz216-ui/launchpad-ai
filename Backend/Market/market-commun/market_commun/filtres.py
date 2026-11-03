"""Filtre ?ids=1,2,3 commun aux listes (utilisé par les clients des autres services)."""

from drf_spectacular.utils import OpenApiParameter
from rest_framework.exceptions import ValidationError

PARAMETRE_IDS = OpenApiParameter(
    "ids", str, description="Liste d'ids séparés par des virgules (ex : 1,2,3)",
)


def filtrer_par_ids(queryset, request):
    valeur = request.query_params.get("ids")
    if valeur is None:
        return queryset
    try:
        ids = [int(i) for i in valeur.split(",") if i.strip()]
    except ValueError:
        raise ValidationError({"ids": "Liste d'entiers séparés par des virgules attendue."})
    return queryset.filter(id__in=ids)
