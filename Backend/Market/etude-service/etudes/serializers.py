"""
Sérialiseurs DRF de l'etude-service.

Formats compatibles avec l'ancien Market-Service : "secteur", "concurrents" et
"tendances" (ids) sont conservés ; "secteur_id", "concurrent_ids" et "tendance_ids"
sont ajoutés. En écriture, les deux noms sont acceptés. Les ids sont vérifiés auprès
de SECTEUR-SERVICE et CONCURRENT-SERVICE : introuvable -> 400, service injoignable -> 503.
"""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from clients import ConcurrentClient, SecteurClient, SwotClient

from . import services
from .models import EtudeMarche, Persona

SECTEUR_INTROUVABLE = "Secteur introuvable"


def _ids(help_text, source=None):
    return serializers.ListField(child=serializers.IntegerField(min_value=1), required=False,
                                 source=source, help_text=help_text)


def _sans_doublon(ids):
    return list(dict.fromkeys(ids))


class PersonaSerializer(serializers.ModelSerializer):
    etude_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Persona
        fields = [
            "id", "etude", "etude_id", "nom", "tranche_age", "profession", "localisation", "revenu_estime",
            "besoins", "frustrations", "comportement_achat", "date_creation",
        ]


class EtudeMarcheListSerializer(serializers.ListSerializer):
    """Liste : les noms de tous les secteurs sont lus en un seul appel (?ids=...)."""

    def to_representation(self, data):
        etudes = list(data.all() if hasattr(data, "all") else data)
        self.context["noms_secteurs"] = SecteurClient().noms({e.secteur_id for e in etudes})
        return super().to_representation(etudes)


class EtudeMarcheSerializer(serializers.ModelSerializer):
    """
    Étude de marché (liste, création, modification).

    `concurrents` et `tendances` s'écrivent et se lisent sous forme de listes d'IDs.
    `statut` ne se modifie que par POST /etudes/<id>/finaliser/.
    """

    secteur_id = serializers.IntegerField(min_value=1, required=False,
                                          help_text="Id du secteur (SECTEUR-SERVICE).")
    secteur = serializers.IntegerField(source="secteur_id", min_value=1, required=False,
                                       help_text="Alias de secteur_id (format de l'ancien Market-Service).")
    secteur_nom = serializers.SerializerMethodField(
        help_text="Nom lu sur SECTEUR-SERVICE ; null si le secteur a été supprimé.")
    concurrent_ids = _ids("IDs des concurrents identifiés pour cette étude (CONCURRENT-SERVICE).")
    concurrents = _ids("Alias de concurrent_ids.", source="concurrent_ids")
    tendance_ids = _ids("IDs des tendances retenues pour cette étude (SECTEUR-SERVICE).")
    tendances = _ids("Alias de tendance_ids.", source="tendance_ids")

    class Meta:
        model = EtudeMarche
        fields = [
            "id", "projet_id", "entrepreneur_id", "statut", "secteur", "secteur_id", "secteur_nom", "titre",
            "taille_marche", "taux_croissance", "cible", "zone_geographique", "hypotheses",
            "description_offre", "prix_propose", "concurrents", "concurrent_ids", "tendances", "tendance_ids",
            "date_creation", "date_mise_a_jour",
        ]
        read_only_fields = ["statut"]
        list_serializer_class = EtudeMarcheListSerializer

    def get_secteur_nom(self, etude) -> str | None:
        noms = self.context.get("noms_secteurs")
        if noms is None:  # détail : un seul secteur à lire
            noms = SecteurClient().noms({etude.secteur_id})
        return noms.get(etude.secteur_id)

    def validate(self, attrs):
        instance = self.instance
        secteur_id = attrs.get("secteur_id")
        if instance is None and secteur_id is None:
            raise serializers.ValidationError({"secteur_id": "Ce champ est obligatoire."})
        # Chaque référence n'est vérifiée que si elle est nouvelle ou modifiée
        if secteur_id is not None and (instance is None or secteur_id != instance.secteur_id):
            if not SecteurClient().exists(secteur_id):
                raise serializers.ValidationError({"secteur_id": SECTEUR_INTROUVABLE})

        if "concurrent_ids" in attrs:
            ids = attrs["concurrent_ids"] = _sans_doublon(attrs["concurrent_ids"])
            nouveaux = set(ids) - set(instance.concurrent_ids if instance else [])
            trouves = {c["id"] for c in ConcurrentClient().list(ids=nouveaux)}
            if nouveaux - trouves:
                raise serializers.ValidationError({"concurrent_ids": "Concurrent(s) introuvable(s) : "
                                                   + ", ".join(map(str, sorted(nouveaux - trouves)))})

        if "tendance_ids" in attrs:
            ids = attrs["tendance_ids"] = _sans_doublon(attrs["tendance_ids"])
            nouveaux = set(ids) - set(instance.tendance_ids if instance else [])
            trouves = {t["id"] for t in SecteurClient().tendances(ids=nouveaux)}
            if nouveaux - trouves:
                raise serializers.ValidationError({"tendance_ids": "Tendance(s) introuvable(s) : "
                                                   + ", ".join(map(str, sorted(nouveaux - trouves)))})
        return attrs


# --- Données des autres services (Swagger : forme documentée) ------------------

class ConcurrentDistantSerializer(serializers.Serializer):
    """Concurrent tel que renvoyé par CONCURRENT-SERVICE."""

    id = serializers.IntegerField()
    nom = serializers.CharField()
    secteur = serializers.IntegerField()
    secteur_id = serializers.IntegerField()
    secteur_nom = serializers.CharField(allow_null=True)
    site_web = serializers.CharField()
    description = serializers.CharField()
    forces = serializers.CharField()
    faiblesses = serializers.CharField()
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2)
    part_de_marche = serializers.DecimalField(max_digits=5, decimal_places=2)
    pays = serializers.CharField()
    date_creation = serializers.DateTimeField()


class TendanceDistanteSerializer(serializers.Serializer):
    """Tendance telle que renvoyée par SECTEUR-SERVICE."""

    id = serializers.IntegerField()
    titre = serializers.CharField()
    secteur = serializers.IntegerField()
    secteur_id = serializers.IntegerField()
    secteur_nom = serializers.CharField()
    description = serializers.CharField()
    impact = serializers.ChoiceField(choices=["positif", "negatif", "neutre"])
    date_creation = serializers.DateTimeField()


class ElementSWOTDistantSerializer(serializers.Serializer):
    """Élément SWOT tel que renvoyé par SWOT-SERVICE."""

    id = serializers.IntegerField()
    etude = serializers.IntegerField()
    etude_id = serializers.IntegerField()
    type = serializers.ChoiceField(choices=["force", "faiblesse", "opportunite", "menace"])
    description = serializers.CharField()
    genere_automatiquement = serializers.BooleanField()
    date_creation = serializers.DateTimeField()


class EtudeMarcheDetailSerializer(EtudeMarcheSerializer):
    """
    Détail d'une étude : ajoute les personas (locaux), la SWOT (SWOT-SERVICE) et le détail
    des concurrents (CONCURRENT-SERVICE) et des tendances (SECTEUR-SERVICE).
    """

    personas = PersonaSerializer(many=True, read_only=True)
    swot = serializers.SerializerMethodField()
    concurrents_details = serializers.SerializerMethodField()
    tendances_details = serializers.SerializerMethodField()

    class Meta(EtudeMarcheSerializer.Meta):
        fields = EtudeMarcheSerializer.Meta.fields + [
            "concurrents_details", "tendances_details", "personas", "swot",
        ]
        list_serializer_class = serializers.ListSerializer

    @extend_schema_field(ElementSWOTDistantSerializer(many=True))
    def get_swot(self, etude):
        return SwotClient().de_l_etude(etude.id)

    @extend_schema_field(ConcurrentDistantSerializer(many=True))
    def get_concurrents_details(self, etude):
        return services.concurrents_de(etude)

    @extend_schema_field(TendanceDistanteSerializer(many=True))
    def get_tendances_details(self, etude):
        return services.tendances_de(etude)


# --- Sérialiseurs de documentation des analyses (Swagger uniquement) ----------
# Ils décrivent la forme des réponses calculées dans services/.

NIVEAUX_CONCURRENCE = [
    ("inconnu", "Inconnu (aucune étude)"),
    ("faible", "Faible"),
    ("moyen", "Moyen"),
    ("eleve", "Élevé"),
]


class ConcurrentResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    pays = serializers.CharField()
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2)
    part_de_marche = serializers.DecimalField(max_digits=5, decimal_places=2)


class TendanceResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    impact = serializers.ChoiceField(choices=["positif", "negatif", "neutre"])


class SecteurResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField(allow_null=True)


class EtudeResumeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    secteur = serializers.CharField(allow_null=True)
    taille_marche = serializers.DecimalField(max_digits=15, decimal_places=2)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)
    cible = serializers.CharField()
    zone_geographique = serializers.CharField()


class SecteurProjetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    nombre_concurrents = serializers.IntegerField()
    part_de_marche_cumulee = serializers.DecimalField(max_digits=7, decimal_places=2)
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    concurrents = ConcurrentResumeSerializer(many=True)
    tendances = TendanceResumeSerializer(many=True)


class AnalyseProjetSerializer(serializers.Serializer):
    projet_id = serializers.IntegerField()
    nombre_etudes = serializers.IntegerField()
    etudes = EtudeResumeSerializer(many=True)
    secteurs = SecteurProjetSerializer(many=True)
    concurrents = ConcurrentResumeSerializer(many=True)
    tendances = TendanceResumeSerializer(many=True)
    niveau_concurrence = serializers.ChoiceField(
        choices=NIVEAUX_CONCURRENCE,
        help_text="'inconnu' si le projet n'a aucune étude de marché.",
    )


POSITIONNEMENTS_PRIX = [
    ("inconnu", "Inconnu (pas de prix proposé ou aucun concurrent)"),
    ("economique", "Économique (< moyenne - 10 %)"),
    ("aligne", "Aligné (moyenne ± 10 %)"),
    ("premium", "Premium (> moyenne + 10 %)"),
]


class ComparaisonPrixSerializer(serializers.Serializer):
    etude_id = serializers.IntegerField()
    prix_propose = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    nombre_concurrents = serializers.IntegerField()
    prix_min = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    prix_moyen = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    prix_max = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    ecart_moyenne_pct = serializers.DecimalField(
        max_digits=9, decimal_places=2, allow_null=True,
        help_text="Écart en % entre le prix proposé et le prix moyen des concurrents.",
    )
    positionnement = serializers.ChoiceField(choices=POSITIONNEMENTS_PRIX)
    concurrents = ConcurrentResumeSerializer(many=True, help_text="Triés par prix croissant.")


class ElementOMSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=["tendance", "concurrence", "croissance", "prix"])
    description = serializers.CharField()


class OpportunitesMenacesSerializer(serializers.Serializer):
    etude_id = serializers.IntegerField()
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)
    positionnement_prix = serializers.ChoiceField(choices=POSITIONNEMENTS_PRIX)
    opportunites = ElementOMSerializer(many=True)
    menaces = ElementOMSerializer(many=True)


class RapportInfoEtudeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    titre = serializers.CharField()
    projet_id = serializers.IntegerField()
    entrepreneur_id = serializers.IntegerField(allow_null=True)
    statut = serializers.ChoiceField(choices=EtudeMarche.Statut.choices)
    date_creation = serializers.DateTimeField()
    date_mise_a_jour = serializers.DateTimeField()


class MarcheCibleSerializer(serializers.Serializer):
    secteur = SecteurResumeSerializer()
    cible = serializers.CharField()
    zone_geographique = serializers.CharField()
    taille_marche = serializers.DecimalField(max_digits=15, decimal_places=2)
    taux_croissance = serializers.DecimalField(max_digits=6, decimal_places=2)


class OffreSerializer(serializers.Serializer):
    description = serializers.CharField()
    prix_propose = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)


class TendanceRapportSerializer(TendanceResumeSerializer):
    description = serializers.CharField()


class ConcurrentRapportSerializer(ConcurrentResumeSerializer):
    site_web = serializers.CharField()
    forces = serializers.CharField()
    faiblesses = serializers.CharField()


class PersonaRapportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    tranche_age = serializers.CharField()
    profession = serializers.CharField()
    localisation = serializers.CharField()
    revenu_estime = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    besoins = serializers.CharField()
    frustrations = serializers.CharField()
    comportement_achat = serializers.CharField()


class OpportunitesMenacesRapportSerializer(serializers.Serializer):
    opportunites = ElementOMSerializer(many=True)
    menaces = ElementOMSerializer(many=True)


class ElementSWOTRapportSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["force", "faiblesse", "opportunite", "menace"])
    description = serializers.CharField()
    genere_automatiquement = serializers.BooleanField()


class SwotRapportSerializer(serializers.Serializer):
    source = serializers.ChoiceField(
        choices=[("enregistree", "Éléments enregistrés"),
                 ("calculee", "Aucun élément enregistré : SWOT calculée à la volée")],
    )
    forces = ElementSWOTRapportSerializer(many=True)
    faiblesses = ElementSWOTRapportSerializer(many=True)
    opportunites = ElementSWOTRapportSerializer(many=True)
    menaces = ElementSWOTRapportSerializer(many=True)


class PotentielCommercialSerializer(serializers.Serializer):
    niveau = serializers.ChoiceField(choices=[("faible", "Faible"), ("moyen", "Moyen"),
                                              ("fort", "Fort")])
    score = serializers.IntegerField()
    score_max = serializers.IntegerField()
    justification = serializers.ListField(child=serializers.CharField())
    conclusion = serializers.CharField()


class RapportEtudeSerializer(serializers.Serializer):
    etude = RapportInfoEtudeSerializer()
    marche_cible = MarcheCibleSerializer()
    hypotheses = serializers.CharField()
    offre = OffreSerializer()
    tendances = TendanceRapportSerializer(many=True)
    concurrents = ConcurrentRapportSerializer(many=True)
    comparaison_prix = ComparaisonPrixSerializer()
    personas = PersonaRapportSerializer(many=True)
    opportunites_menaces = OpportunitesMenacesRapportSerializer()
    swot = SwotRapportSerializer()
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    potentiel_commercial = PotentielCommercialSerializer()


class HealthSerializer(serializers.Serializer):
    status = serializers.CharField()
    service = serializers.CharField()


class ServiceIndisponibleSerializer(serializers.Serializer):
    service = serializers.CharField()
    message = serializers.CharField()
