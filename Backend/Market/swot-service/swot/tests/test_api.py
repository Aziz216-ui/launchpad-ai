"""Tests de l'API du swot-service (ETUDE-SERVICE est mocké)."""

import copy
import json
import tempfile
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clients import RessourceIntrouvable, ServiceIndisponible
from swot.models import ElementSWOT

ETUDE = 1
AUTRE_ETUDE = 2

# Réponses d'ETUDE-SERVICE pour l'étude "Paiement PME" des anciens tests : 4 concurrents
# (prix moyen 20, part cumulée 65 %), prix proposé 16, croissance 12,5 %, aucun persona.
DETAIL = {"id": ETUDE, "titre": "Paiement PME", "prix_propose": 16.0, "description_offre": "QR code",
          "personas": [], "concurrent_ids": [1, 2, 3, 4]}
PRIX = {"etude_id": ETUDE, "prix_propose": 16.0, "nombre_concurrents": 4, "prix_min": 10.0,
        "prix_moyen": 20.0, "prix_max": 30.0, "ecart_moyenne_pct": -20.0, "positionnement": "economique",
        "concurrents": []}
OM = {
    "etude_id": ETUDE, "niveau_concurrence": "eleve", "taux_croissance": 12.5, "positionnement_prix": "economique",
    "opportunites": [
        {"source": "tendance", "description": "Mobile : En hausse"},
        {"source": "croissance", "description": "Marché en forte croissance (+12.5 % par an)."},
        {"source": "prix", "description": "Prix inférieur de 20 % à la moyenne des concurrents : ..."},
    ],
    "menaces": [
        {"source": "tendance", "description": "Régulation"},
        {"source": "concurrence", "description": "Concurrence élevée : 4 concurrent(s) identifié(s) "
                                                 "occupant une large part du marché."},
    ],
}


class EtudeServiceMockeMixin:
    """Remplace les appels à ETUDE-SERVICE (clients/etude_client.py) par des données en mémoire."""

    def setUp(self):
        super().setUp()
        self.detail, self.prix, self.om = copy.deepcopy(DETAIL), copy.deepcopy(PRIX), copy.deepcopy(OM)
        self.etudes = {ETUDE, AUTRE_ETUDE}

        def get(client, id):
            if id not in self.etudes:
                raise RessourceIntrouvable(id)
            return self.detail

        def exists(client, id):
            return id in self.etudes

        for methode, fonction in [("get", get), ("exists", exists),
                                  ("comparaison_prix", lambda client, id: self.prix),
                                  ("opportunites_menaces", lambda client, id: self.om)]:
            patcher = mock.patch(f"clients.etude_client.EtudeClient.{methode}", autospec=True, side_effect=fonction)
            setattr(self, methode, patcher.start())
            self.addCleanup(patcher.stop)

    def generer(self, etude=ETUDE):
        return self.client.post(reverse("etude-generer-swot", args=[etude]))


class SwotCrudTests(EtudeServiceMockeMixin, APITestCase):
    def test_crud(self):
        liste = reverse("swot-list")
        response = self.client.post(liste, {
            "etude": ETUDE, "type": "force", "description": "Équipe expérimentée",
            "genere_automatiquement": True,  # ignoré : une saisie API est manuelle
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertFalse(response.data["genere_automatiquement"])
        self.assertEqual((response.data["etude"], response.data["etude_id"]), (ETUDE, ETUDE))

        detail = reverse("swot-detail", args=[response.data["id"]])
        response = self.client.patch(detail, {"type": "opportunite"}, format="json")
        self.assertEqual(response.data["type"], "opportunite")
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)

    def test_etude_absente_400(self):
        response = self.client.post(reverse("swot-list"), {
            "etude_id": 9999, "type": "force", "description": "X",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"etude_id": ["Étude introuvable"]})

    def test_etude_service_indisponible_503(self):
        self.exists.side_effect = ServiceIndisponible("ETUDE-SERVICE")
        response = self.client.post(reverse("swot-list"), {
            "etude_id": ETUDE, "type": "force", "description": "X",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "ETUDE-SERVICE", "message": "Service indisponible"})
        self.assertFalse(ElementSWOT.objects.exists())

    def test_type_invalide(self):
        response = self.client.post(reverse("swot-list"), {
            "etude": ETUDE, "type": "autre", "description": "X",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", response.data)

    def test_filtres_etude_et_type(self):
        ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="F1")
        ElementSWOT.objects.create(etude_id=ETUDE, type="menace", description="M1")
        ElementSWOT.objects.create(etude_id=AUTRE_ETUDE, type="force", description="F2")
        response = self.client.get(reverse("swot-list"), {"etude": ETUDE, "type": "force"})
        self.assertEqual([e["description"] for e in response.data], ["F1"])

    def test_supprimer_la_swot_d_une_etude(self):
        ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="F1")
        ElementSWOT.objects.create(etude_id=AUTRE_ETUDE, type="force", description="F2")
        response = self.client.delete(reverse("swot-par-etude", args=[ETUDE]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(list(ElementSWOT.objects.values_list("description", flat=True)), ["F2"])


class GenererSwotTests(EtudeServiceMockeMixin, APITestCase):
    def test_generation_conserve_les_elements_manuels(self):
        manuel = ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="Équipe expérimentée")
        response = self.generer()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conserves"], 1)
        generes = response.data["generes"]
        self.assertGreater(generes, 0)

        descriptions = {(e["type"], e["description"]) for e in response.data["swot"]}
        self.assertIn(("force", "Équipe expérimentée"), descriptions)
        # Règles : prix sous la moyenne -> force ; concurrence élevée -> menace ;
        # croissance > 10 % -> opportunité ; aucun persona -> faiblesse
        self.assertIn(("force", "Prix proposé inférieur de 20 % à la moyenne des concurrents."), descriptions)
        self.assertIn(("faiblesse", "Cible clients non définie : aucun persona."), descriptions)
        self.assertIn(("opportunite", "Mobile : En hausse"), descriptions)
        self.assertIn(("menace", "Régulation"), descriptions)
        # Le positionnement prix n'est pas repris en opportunité (déjà compté en force)
        self.assertFalse([d for t, d in descriptions if t == "opportunite" and d.startswith("Prix inférieur")])
        types = [e["type"] for e in response.data["swot"] if e["genere_automatiquement"]]
        self.assertEqual(sorted(set(types)), ["faiblesse", "force", "menace", "opportunite"])

        # Une 2e génération remplace les éléments automatiques sans doublon
        self.generer()
        self.assertEqual(ElementSWOT.objects.filter(etude_id=ETUDE, genere_automatiquement=True).count(), generes)
        self.assertTrue(ElementSWOT.objects.filter(id=manuel.id).exists())

    def test_generation_suit_les_donnees(self):
        self.generer()
        self.detail["personas"] = [{"id": 1, "nom": "Sami"}]
        self.generer()
        descriptions = list(ElementSWOT.objects.values_list("description", flat=True))
        self.assertNotIn("Cible clients non définie : aucun persona.", descriptions)
        self.assertIn("Cible clients définie (1 persona(s)).", descriptions)

    def test_offre_non_chiffree_ni_decrite_sans_concurrent(self):
        self.detail.update(prix_propose=None, description_offre="  ")
        self.prix.update(positionnement="inconnu", nombre_concurrents=0, ecart_moyenne_pct=None)
        response = self.generer()
        descriptions = {e["description"] for e in response.data["swot"]}
        self.assertTrue({"Offre non chiffrée : aucun prix proposé.", "Offre non décrite.",
                         "Concurrence non étudiée : aucun concurrent identifié."} <= descriptions)

    def test_prix_premium_et_aligne(self):
        self.prix["positionnement"] = "premium"
        self.assertIn(("faiblesse", "Prix proposé supérieur à la moyenne des concurrents."),
                      {(e["type"], e["description"]) for e in self.generer().data["swot"]})
        self.prix["positionnement"] = "aligne"
        self.assertIn(("force", "Prix proposé aligné sur le marché."),
                      {(e["type"], e["description"]) for e in self.generer().data["swot"]})

    def test_etude_inexistante_404(self):
        response = self.generer(9999)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(ElementSWOT.objects.exists())

    def test_etude_service_indisponible_503_sans_rien_supprimer(self):
        ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="Auto", genere_automatiquement=True)
        self.comparaison_prix.side_effect = ServiceIndisponible("CONCURRENT-SERVICE")
        response = self.generer()
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "CONCURRENT-SERVICE", "message": "Service indisponible"})
        self.assertEqual(ElementSWOT.objects.count(), 1)

    def test_apercu_sans_enregistrement(self):
        response = self.client.get(reverse("etude-generer-swot", args=[ETUDE]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["etude_id"], ETUDE)
        self.assertIn({"type": "faiblesse", "description": "Cible clients non définie : aucun persona."},
                      response.json()["elements"])
        self.assertFalse(ElementSWOT.objects.exists())


class DiversTests(EtudeServiceMockeMixin, APITestCase):
    def test_health(self):
        response = self.client.get("/api/market/swot/health/")
        self.assertEqual(response.json(), {"status": "UP", "service": "swot-service"})

    def test_seed_idempotent(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump({"etudes": {"1|Paiement mobile pour PME": ETUDE,
                                  "2|Plateforme de soutien scolaire": AUTRE_ETUDE}}, f)
        call_command("seed_swot", ids=f.name, stdout=StringIO())
        call_command("seed_swot", ids=f.name, stdout=StringIO())
        self.assertEqual(ElementSWOT.objects.filter(genere_automatiquement=False).count(), 1)
        for etude in (ETUDE, AUTRE_ETUDE):
            self.assertTrue(ElementSWOT.objects.filter(etude_id=etude, genere_automatiquement=True).exists())
        # Génération faite une seule fois par étude
        self.assertEqual(self.comparaison_prix.call_count, 2)

    def test_swagger(self):
        self.assertEqual(self.client.get("/api/market/swot/docs/").status_code, 200)
        paths = self.client.get("/api/market/swot/schema/", {"format": "json"}).json()["paths"]
        for chemin in ["/api/market/swot/", "/api/market/etudes/{etude_id}/generer-swot/"]:
            self.assertIn(chemin, paths)
