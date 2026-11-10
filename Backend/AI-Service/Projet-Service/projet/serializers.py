"""Serialiseurs DRF pour l'application projet."""
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

from .models import Projet, AnalyseProjet
from .services import market_client

MESSAGE_SECTEUR_SANS_ETUDE = "Ce secteur n'a pas d'étude de marché pour ce projet."


class EtudeServiceIndisponible(APIException):
    """ETUDE-SERVICE injoignable : le secteur ne peut pas être vérifié, le projet n'est pas modifié."""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = (
        "Le service Étude de marché est indisponible : impossible de vérifier le secteur. "
        "Le projet n'a pas été modifié, réessayez plus tard."
    )
    default_code = "etude_service_indisponible"


class AnalyseProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyseProjet
        fields = [
            "id", "projet", "forces", "faiblesses", "score_global",
            "resume", "source", "date_creation",
        ]
        read_only_fields = ["id", "date_creation"]


class ProjetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projet
        fields = [
            "id", "entrepreneur_id", "titre", "idee", "objectifs", "secteur", "secteur_id",
            "stade", "public_cible", "budget_estime", "statut",
            "date_creation", "date_mise_a_jour",
        ]
        read_only_fields = ["id", "date_creation", "date_mise_a_jour"]

    def validate(self, attrs):
        """
        Si secteur_id est fourni (non nul), il doit être l'un des secteurs des études de marché
        du projet (ETUDE-SERVICE, GET /api/market/analyse/projet/{id}/). Le nom du secteur
        est alors recopié dans "secteur". Un nouveau projet n'a encore aucune étude.
        """
        attrs = super().validate(attrs)
        secteur_id = attrs.get("secteur_id")
        if secteur_id is None:
            return attrs

        if self.instance is None:
            raise serializers.ValidationError({"secteur_id": [MESSAGE_SECTEUR_SANS_ETUDE]})

        try:
            secteurs = market_client.recuperer_secteurs_projet(self.instance.pk)
        except market_client.MarcheIndisponible as exc:
            raise EtudeServiceIndisponible() from exc

        secteur = next((s for s in secteurs if s["id"] == secteur_id), None)
        if secteur is None:
            raise serializers.ValidationError({"secteur_id": [MESSAGE_SECTEUR_SANS_ETUDE]})
        attrs["secteur"] = secteur["nom"]
        return attrs


class ProjetListSerializer(serializers.ModelSerializer):
    """Liste allegee."""
    class Meta:
        model = Projet
        fields = [
            "id", "entrepreneur_id", "titre", "secteur", "secteur_id", "stade", "statut",
            "date_creation", "date_mise_a_jour",
        ]
