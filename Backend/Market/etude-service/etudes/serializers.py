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
from market_commun.validation import verifier_reference

from . import services
from .models import EtudeMarche, Persona

SECTEUR_INTROUVABLE = "Secteur introuvable"
CONCURRENTS_HORS_SECTEUR = "Concurrent(s) hors du secteur de l'étude"
TENDANCES_HORS_SECTEUR = "Tendance(s) hors du secteur de l'étude"


def verifier_liste_du_secteur(attrs, instance, champ, lister, secteur_id, secteur_change,
                              introuvable, hors_secteur):
    """
    Liste d'ids (concurrent_ids, tendance_ids) cohérente avec le secteur de l'étude.

    - doublons retirés ; ids NOUVEAUX : introuvables -> 400, d'un autre secteur -> 400 ;
    - si le secteur change : les ids déjà associés qui ne sont pas du nouveau secteur (ou qui
      n'existent plus) sont retirés automatiquement ; renvoie la liste des ids retirés.

    Un seul appel lister(ids) par champ. Les ids déjà associés ne sont relus que si le
    secteur change (une étude existante reste modifiable sans tout revérifier).
    """
    anciens = list(getattr(instance, champ, None) or [])
    fournis = champ in attrs
    ids = [*dict.fromkeys(attrs[champ])] if fournis else anciens  # ordre conservé, doublons retirés
    nouveaux = set(ids).difference(anciens)
    a_lire = set(ids) if secteur_change else nouveaux
    objets = {objet["id"]: objet for objet in lister(a_lire)} if a_lire else {}

    manquants = nouveaux - objets.keys()
    if manquants:
        raise serializers.ValidationError({champ: f"{introuvable} : " + ", ".join(map(str, sorted(manquants)))})
    if secteur_id is not None:
        hors = sorted(i for i in nouveaux if objets[i]["secteur_id"] != secteur_id)
        if hors:
            raise serializers.ValidationError({champ: f"{hors_secteur} : " + ", ".join(map(str, hors))})

    retires = []
    if secteur_change:
        retires = [i for i in ids if i not in nouveaux
                   and (i not in objets or objets[i]["secteur_id"] != secteur_id)]
    if fournis or retires:
        attrs[champ] = [i for i in ids if i not in retires]
    return retires


def _ids(help_text, source=None):
    return serializers.ListField(child=serializers.IntegerField(min_value=1), required=False,
                                 source=source, help_text=help_text)


class PersonaSerializer(serializers.ModelSerializer):
    etude_id = serializers.IntegerField(read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Études visibles par l'utilisateur (voir views.etudes_visibles) : celle d'un autre
        # entrepreneur est refusée comme si elle n'existait pas
        visibles = self.context.get("etudes_visibles")
        if visibles is not None and "etude" in self.fields:
            self.fields["etude"].queryset = visibles

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

    Cohérence avec le secteur : un concurrent ou une tendance ajouté doit être du secteur de
    l'étude (sinon 400). Quand le secteur change, ceux qui n'en sont pas sont retirés et la
    réponse les liste dans "concurrents_retires" et "tendances_retirees" (création et
    modification uniquement).
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
        # Chaque référence n'est vérifiée que si elle est nouvelle ou modifiée
        verifier_reference(attrs, self.instance, "secteur_id", SecteurClient().exists, SECTEUR_INTROUVABLE)
        secteur_id = attrs.get("secteur_id", getattr(self.instance, "secteur_id", None))
        secteur_change = (self.instance is not None and "secteur_id" in attrs
                          and attrs["secteur_id"] != self.instance.secteur_id)
        self._retires = {
            "concurrents_retires": verifier_liste_du_secteur(
                attrs, self.instance, "concurrent_ids", lambda ids: ConcurrentClient().list(ids=ids),
                secteur_id, secteur_change, "Concurrent(s) introuvable(s)", CONCURRENTS_HORS_SECTEUR),
            "tendances_retirees": verifier_liste_du_secteur(
                attrs, self.instance, "tendance_ids", lambda ids: SecteurClient().tendances(ids=ids),
                secteur_id, secteur_change, "Tendance(s) introuvable(s)", TENDANCES_HORS_SECTEUR),
        }
        return attrs

    def to_representation(self, etude):
        data = super().to_representation(etude)
        # Après une création / modification : ids retirés automatiquement (changement de secteur)
        retires = getattr(self, "_retires", None)
        if retires is not None:
            data.update(retires)
        return data


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
    ("inconnu", "Inconnu (aucune étude ou aucun concurrent)"),
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
    # Même calcul que GET /etudes/<id>/comparaison-prix/ (sur les concurrents de l'étude)
    prix_propose = serializers.DecimalField(max_digits=12, decimal_places=2, allow_null=True)
    prix_moyen_concurrents = serializers.DecimalField(
        max_digits=12, decimal_places=2, allow_null=True, help_text="null si l'étude n'a aucun concurrent.")
    ecart_pourcentage = serializers.DecimalField(
        max_digits=9, decimal_places=2, allow_null=True,
        help_text="Écart en % entre le prix proposé et le prix moyen des concurrents.")
    positionnement = serializers.ChoiceField(choices=[
        ("inconnu", "Inconnu (pas de prix proposé ou aucun concurrent)"),
        ("economique", "Économique (< moyenne - 10 %)"),
        ("aligne", "Aligné (moyenne ± 10 %)"),
        ("premium", "Premium (> moyenne + 10 %)"),
    ])


class SecteurProjetSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nom = serializers.CharField()
    nombre_concurrents = serializers.IntegerField()
    part_de_marche_cumulee = serializers.DecimalField(max_digits=7, decimal_places=2)
    niveau_concurrence = serializers.ChoiceField(choices=NIVEAUX_CONCURRENCE)
    concurrents = ConcurrentResumeSerializer(many=True, help_text="Concurrents associés aux études du secteur.")
    tendances = TendanceResumeSerializer(many=True)
    source_tendances = serializers.ChoiceField(
        choices=[("etudes", "Tendances retenues dans les études"),
                 ("secteur", "Aucune retenue : toutes les tendances du secteur")])


class AnalyseProjetSerializer(serializers.Serializer):
    projet_id = serializers.IntegerField()
    nombre_etudes = serializers.IntegerField()
    etudes = EtudeResumeSerializer(many=True)
    secteurs = SecteurProjetSerializer(many=True)
    concurrents = ConcurrentResumeSerializer(many=True)
    tendances = TendanceResumeSerializer(many=True)
    niveau_concurrence = serializers.ChoiceField(
        choices=NIVEAUX_CONCURRENCE,
        help_text="Le plus élevé des secteurs ; 'inconnu' si le projet n'a aucune étude "
                  "ou aucun concurrent associé à ses études.",
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
    entrepreneur_id = serializers.CharField(allow_null=True, help_text="Identifiant Keycloak du propriétaire.")
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

