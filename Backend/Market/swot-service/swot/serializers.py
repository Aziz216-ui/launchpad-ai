"""
Sérialiseurs DRF du swot-service.

Format compatible avec l'ancien Market-Service : "etude" (id) est conservé et
"etude_id" ajouté ; les deux sont acceptés en écriture. L'étude est vérifiée
auprès d'ETUDE-SERVICE : introuvable -> 400, service injoignable -> 503.
"""

from rest_framework import serializers

from clients import EtudeClient

from .models import ElementSWOT

ETUDE_INTROUVABLE = "Étude introuvable"


class ElementSWOTSerializer(serializers.ModelSerializer):
    etude_id = serializers.IntegerField(min_value=1, required=False,
                                        help_text="Id de l'étude (ETUDE-SERVICE).")
    etude = serializers.IntegerField(source="etude_id", min_value=1, required=False,
                                     help_text="Alias de etude_id (format de l'ancien Market-Service).")

    class Meta:
        model = ElementSWOT
        fields = ["id", "etude", "etude_id", "type", "description", "genere_automatiquement", "date_creation"]
        # Un élément créé via l'API est toujours une saisie manuelle
        read_only_fields = ["genere_automatiquement"]

    def validate(self, attrs):
        etude_id = attrs.get("etude_id")
        if self.instance is None and etude_id is None:
            raise serializers.ValidationError({"etude_id": "Ce champ est obligatoire."})
        if etude_id is not None and (self.instance is None or etude_id != self.instance.etude_id):
            if not EtudeClient().exists(etude_id):
                raise serializers.ValidationError({"etude_id": ETUDE_INTROUVABLE})
        return attrs


# --- Sérialiseurs de documentation (Swagger uniquement) -----------------------

class GenererSwotSerializer(serializers.Serializer):
    generes = serializers.IntegerField(help_text="Éléments générés automatiquement.")
    conserves = serializers.IntegerField(help_text="Éléments saisis à la main, conservés.")
    swot = ElementSWOTSerializer(many=True)


class ElementCalculeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=ElementSWOT.Type.choices)
    description = serializers.CharField()


class ApercuSwotSerializer(serializers.Serializer):
    etude_id = serializers.IntegerField()
    elements = ElementCalculeSerializer(many=True)


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class ServiceIndisponibleSerializer(serializers.Serializer):
    service = serializers.CharField()
    message = serializers.CharField()
