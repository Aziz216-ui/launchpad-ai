"""
Sérialiseurs DRF du concurrent-service.

Format compatible avec l'ancien Market-Service : "secteur" (id) et "secteur_nom" sont
conservés, "secteur_id" est ajouté. En écriture, "secteur" et "secteur_id" sont
acceptés (même valeur). Le secteur est vérifié auprès de SECTEUR-SERVICE :
introuvable -> 400 "Secteur introuvable", service injoignable -> 503.
"""

from rest_framework import serializers

from clients import SecteurClient

from .models import Concurrent

SECTEUR_INTROUVABLE = "Secteur introuvable"


class ConcurrentListSerializer(serializers.ListSerializer):
    """Liste : les noms de tous les secteurs sont lus en un seul appel (?ids=...)."""

    def to_representation(self, data):
        concurrents = list(data.all() if hasattr(data, "all") else data)
        self.context["noms_secteurs"] = SecteurClient().noms({c.secteur_id for c in concurrents})
        return super().to_representation(concurrents)


class ConcurrentSerializer(serializers.ModelSerializer):
    secteur_id = serializers.IntegerField(min_value=1, required=False,
                                          help_text="Id du secteur (SECTEUR-SERVICE).")
    secteur = serializers.IntegerField(source="secteur_id", min_value=1, required=False,
                                       help_text="Alias de secteur_id (format de l'ancien Market-Service).")
    secteur_nom = serializers.SerializerMethodField(
        help_text="Nom lu sur SECTEUR-SERVICE ; null si le secteur a été supprimé.")

    class Meta:
        model = Concurrent
        fields = [
            "id", "nom", "secteur", "secteur_id", "secteur_nom", "site_web", "description",
            "forces", "faiblesses", "prix_moyen", "part_de_marche", "pays", "date_creation",
        ]
        list_serializer_class = ConcurrentListSerializer

    def get_secteur_nom(self, concurrent) -> str | None:
        noms = self.context.get("noms_secteurs")
        if noms is None:  # détail : un seul secteur à lire
            noms = SecteurClient().noms({concurrent.secteur_id})
        return noms.get(concurrent.secteur_id)

    def validate(self, attrs):
        secteur_id = attrs.get("secteur_id")
        if self.instance is None and secteur_id is None:
            raise serializers.ValidationError({"secteur_id": "Ce champ est obligatoire."})
        # Vérifié à la création, et à la modification seulement si le secteur change
        if secteur_id is not None and (self.instance is None or secteur_id != self.instance.secteur_id):
            if not SecteurClient().exists(secteur_id):
                raise serializers.ValidationError({"secteur_id": SECTEUR_INTROUVABLE})
        return attrs


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class ServiceIndisponibleSerializer(serializers.Serializer):
    service = serializers.CharField()
    message = serializers.CharField()
