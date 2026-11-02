"""Tests de l'API du concurrent-service (SECTEUR-SERVICE est mocké)."""

import json
import tempfile
from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clients import ServiceIndisponible
from concurrents.models import Concurrent

FINTECH, EDTECH = 1, 2
SECTEURS = {FINTECH: "FinTech", EDTECH: "EdTech"}


def faux_list(self, ids=None, **filtres):
    """SECTEUR-SERVICE simulé : GET /api/market/secteurs/?ids=..."""
    ids = SECTEURS if ids is None else ids
    return [{"id": i, "nom": SECTEURS[i]} for i in sorted(ids) if i in SECTEURS]


def faux_exists(self, id):
    return id in SECTEURS


class SecteurServiceMockeMixin:
    """Remplace les appels à SECTEUR-SERVICE (clients/secteur_client.py) par des données en mémoire."""

    def setUp(self):
        super().setUp()
        for methode, fonction in [("list", faux_list), ("exists", faux_exists)]:
            patcher = mock.patch(f"clients.secteur_client.SecteurClient.{methode}", autospec=True,
                                 side_effect=fonction)
            setattr(self, methode, patcher.start())
            self.addCleanup(patcher.stop)


class ConcurrentCrudTests(SecteurServiceMockeMixin, APITestCase):
    """CRUD complet sur /api/market/concurrents/."""

    def setUp(self):
        super().setUp()
        self.c1 = Concurrent.objects.create(
            nom="Flouci", secteur_id=FINTECH, pays="Tunisie",
            prix_moyen=Decimal("10"), part_de_marche=Decimal("20"),
        )
        self.c2 = Concurrent.objects.create(
            nom="Coursera", secteur_id=EDTECH, pays="États-Unis",
            prix_moyen=Decimal("45"), part_de_marche=Decimal("30"),
        )
        self.liste_url = reverse("concurrent-list")

    def detail_url(self, pk):
        return reverse("concurrent-detail", args=[pk])

    def test_lister(self):
        response = self.client.get(self.liste_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual({c["secteur_nom"] for c in response.data}, {"FinTech", "EdTech"})
        # Un seul appel à SECTEUR-SERVICE pour toute la liste
        self.assertEqual(self.list.call_count, 1)

    def test_format_compatible_avec_l_ancien_service(self):
        data = self.client.get(self.detail_url(self.c1.id)).json()
        self.assertEqual(set(data), {
            "id", "nom", "secteur", "secteur_id", "secteur_nom", "site_web", "description",
            "forces", "faiblesses", "prix_moyen", "part_de_marche", "pays", "date_creation",
        })
        self.assertEqual((data["secteur"], data["secteur_id"], data["secteur_nom"]), (FINTECH, FINTECH, "FinTech"))

    def test_creer_secteur_existant(self):
        data = {
            "nom": "Konnect", "secteur": FINTECH, "pays": "Tunisie",
            "prix_moyen": "25.00", "part_de_marche": "12.50",
        }
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["secteur_nom"], "FinTech")
        self.assertEqual(response.data["secteur_id"], FINTECH)
        self.exists.assert_called_once_with(mock.ANY, FINTECH)
        self.assertEqual(Concurrent.objects.count(), 3)

    def test_creer_avec_secteur_id(self):
        response = self.client.post(self.liste_url, {"nom": "Paymee", "secteur_id": FINTECH}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_creer_secteur_absent_400(self):
        response = self.client.post(self.liste_url, {"nom": "X", "secteur_id": 9999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"secteur_id": ["Secteur introuvable"]})
        self.assertEqual(Concurrent.objects.count(), 2)

    def test_creer_sans_secteur_400(self):
        response = self.client.post(self.liste_url, {"nom": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("secteur_id", response.data)

    def test_creer_secteur_service_indisponible_503(self):
        self.exists.side_effect = ServiceIndisponible("SECTEUR-SERVICE")
        response = self.client.post(self.liste_url, {"nom": "X", "secteur_id": FINTECH}, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "SECTEUR-SERVICE", "message": "Service indisponible"})
        self.assertEqual(Concurrent.objects.count(), 2)

    def test_lire(self):
        response = self.client.get(self.detail_url(self.c1.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["nom"], "Flouci")

    def test_decimaux_renvoyes_en_nombres(self):
        # COERCE_DECIMAL_TO_STRING = False : 10.0 et non "10.00" dans le JSON
        data = self.client.get(self.detail_url(self.c1.id)).json()
        self.assertEqual(data["prix_moyen"], 10.0)
        self.assertEqual(data["part_de_marche"], 20.0)
        self.assertIsInstance(data["prix_moyen"], float)

    def test_modifier_sans_changer_de_secteur(self):
        response = self.client.patch(self.detail_url(self.c1.id), {"part_de_marche": "22.00"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.c1.refresh_from_db()
        self.assertEqual(self.c1.part_de_marche, Decimal("22.00"))
        self.exists.assert_not_called()  # secteur inchangé : pas d'appel

    def test_modifier_vers_un_secteur_absent(self):
        response = self.client.patch(self.detail_url(self.c1.id), {"secteur": 9999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"secteur_id": ["Secteur introuvable"]})

    def test_supprimer(self):
        response = self.client.delete(self.detail_url(self.c1.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Concurrent.objects.filter(id=self.c1.id).exists())

    def test_secteur_supprime_secteur_nom_null(self):
        # Le secteur a été supprimé dans SECTEUR-SERVICE : pas de crash
        Concurrent.objects.create(nom="Orphelin", secteur_id=777)
        response = self.client.get(self.liste_url, {"search": "Orphelin"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data[0]["secteur_nom"])
        self.assertEqual(response.data[0]["secteur_id"], 777)

    def test_lecture_si_secteur_service_indisponible(self):
        self.list.side_effect = ServiceIndisponible("SECTEUR-SERVICE")
        with self.assertLogs("clients.secteur_client", "WARNING"):
            response = self.client.get(self.liste_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([c["secteur_nom"] for c in response.data], [None, None])

    def test_part_de_marche_invalide(self):
        data = {"nom": "X", "secteur": FINTECH, "part_de_marche": "120"}
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("part_de_marche", response.data)

    def test_prix_negatif_invalide(self):
        data = {"nom": "X", "secteur": FINTECH, "prix_moyen": "-5"}
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prix_moyen", response.data)

    def test_filtre_secteur(self):
        response = self.client.get(self.liste_url, {"secteur": FINTECH})
        self.assertEqual([c["nom"] for c in response.data], ["Flouci"])

    def test_filtre_pays(self):
        response = self.client.get(self.liste_url, {"pays": "tunisie"})
        self.assertEqual([c["nom"] for c in response.data], ["Flouci"])

    def test_recherche_nom(self):
        response = self.client.get(self.liste_url, {"search": "cours"})
        self.assertEqual([c["nom"] for c in response.data], ["Coursera"])

    def test_tri(self):
        response = self.client.get(self.liste_url, {"ordering": "prix_moyen"})
        self.assertEqual([c["nom"] for c in response.data], ["Flouci", "Coursera"])
        # Tri par défaut : part de marché décroissante
        self.assertEqual([c["nom"] for c in self.client.get(self.liste_url).data], ["Coursera", "Flouci"])

    def test_filtre_ids(self):
        response = self.client.get(self.liste_url, {"ids": f"{self.c2.id},9999"})
        self.assertEqual([c["nom"] for c in response.data], ["Coursera"])


class DiversTests(SecteurServiceMockeMixin, APITestCase):
    def test_health(self):
        response = self.client.get("/api/market/concurrents/health/")
        self.assertEqual(response.json(), {"status": "UP", "service": "concurrent-service"})

    def test_seed_idempotent_avec_fichier_ids(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump({"secteurs": {"FinTech": 11, "EdTech": 12, "HealthTech": 13}}, f)
        call_command("seed_concurrents", ids=f.name, stdout=StringIO())
        call_command("seed_concurrents", ids=f.name, stdout=StringIO())
        self.assertEqual(Concurrent.objects.count(), 10)
        self.assertEqual(Concurrent.objects.get(nom="Doctolib").secteur_id, 13)

    def test_seed_sans_fichier_lit_secteur_service(self):
        SECTEURS[3] = "HealthTech"
        self.addCleanup(SECTEURS.pop, 3)
        call_command("seed_concurrents", stdout=StringIO())
        self.assertEqual(Concurrent.objects.filter(secteur_id=FINTECH).count(), 4)

    def test_swagger(self):
        self.assertEqual(self.client.get("/api/market/concurrents/docs/").status_code, 200)
        schema = self.client.get("/api/market/concurrents/schema/", {"format": "json"}).json()
        self.assertIn("/api/market/concurrents/", schema["paths"])
        self.assertEqual(schema["components"]["schemas"]["Concurrent"]["properties"]["prix_moyen"]["type"],
                         "number")
