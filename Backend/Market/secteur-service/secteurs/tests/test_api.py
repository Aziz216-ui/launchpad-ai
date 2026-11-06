"""Tests de l'API du secteur-service (CONCURRENT-SERVICE est mocké)."""

from decimal import Decimal
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clients import ServiceIndisponible
from market_commun.evenements.models import EvenementOutbox
from secteurs.models import Secteur, Tendance
from secteurs.services import calculer_niveau_concurrence

DU_SECTEUR = "secteurs.services.analyse.ConcurrentClient.du_secteur"


def concurrent(id, nom, prix, part, pays="Tunisie"):
    """Concurrent tel que renvoyé par CONCURRENT-SERVICE (décimaux en nombres JSON)."""
    return {"id": id, "nom": nom, "secteur": 1, "secteur_id": 1, "secteur_nom": "FinTech",
            "pays": pays, "prix_moyen": float(prix), "part_de_marche": float(part)}


class SecteurCrudTests(APITestCase):
    def setUp(self):
        self.fintech = Secteur.objects.create(nom="FinTech", description="Paiement")
        self.edtech = Secteur.objects.create(nom="EdTech")

    def test_crud(self):
        response = self.client.post(reverse("secteur-list"), {"nom": "HealthTech"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(response.data), {"id", "nom", "description", "date_creation"})
        detail = reverse("secteur-detail", args=[response.data["id"]])
        self.assertEqual(self.client.patch(detail, {"description": "Santé"}, format="json").data["description"],
                         "Santé")
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)

    def test_nom_unique(self):
        response = self.client.post(reverse("secteur-list"), {"nom": "FinTech"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lister_tries_par_nom(self):
        noms = [s["nom"] for s in self.client.get(reverse("secteur-list")).data]
        self.assertEqual(noms, ["EdTech", "FinTech"])

    def test_filtre_ids(self):
        # Utilisé par les clients des autres services : un seul appel pour N secteurs
        response = self.client.get(reverse("secteur-list"), {"ids": f"{self.fintech.id},9999"})
        self.assertEqual([s["nom"] for s in response.data], ["FinTech"])

    def test_filtre_ids_invalide(self):
        response = self.client.get(reverse("secteur-list"), {"ids": "1,abc"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_secteur_inexistant_404(self):
        response = self.client.get(reverse("secteur-detail", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_suppression_supprime_les_tendances(self):
        Tendance.objects.create(titre="Mobile", secteur=self.fintech)
        self.client.delete(reverse("secteur-detail", args=[self.fintech.id]))
        self.assertFalse(Tendance.objects.exists())

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_suppression_publie_secteur_supprime(self, envoyer):
        with self.assertLogs("market_commun.evenements.producteur", "INFO"), self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("secteur-detail", args=[self.fintech.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        message = envoyer.call_args.args[0]
        self.assertEqual(message["event"], "secteur.supprime")
        self.assertEqual(message["data"], {"secteur_id": self.fintech.id, "nom": "FinTech"})

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_creation_et_modification_ne_publient_rien(self, envoyer):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.post(reverse("secteur-list"), {"nom": "AgriTech"}, format="json")
            self.client.patch(reverse("secteur-detail", args=[self.edtech.id]), {"description": "X"}, format="json")
        envoyer.assert_not_called()

    @mock.patch("market_commun.evenements.producteur.envoyer", side_effect=ConnectionError("RabbitMQ arrêté"))
    def test_suppression_reussit_meme_si_rabbitmq_est_arrete(self, envoyer):
        with self.assertLogs("market_commun.evenements.producteur", "ERROR"), self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse("secteur-detail", args=[self.fintech.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(EvenementOutbox.objects.get().routing_key, "secteur.supprime")


class TendanceCrudTests(APITestCase):
    def setUp(self):
        self.fintech = Secteur.objects.create(nom="FinTech")
        self.edtech = Secteur.objects.create(nom="EdTech")
        self.t1 = Tendance.objects.create(titre="Mobile", secteur=self.fintech, impact="positif")
        self.t2 = Tendance.objects.create(titre="Hybride", secteur=self.edtech, impact="negatif")

    def test_creer(self):
        response = self.client.post(reverse("tendance-list"), {
            "titre": "Open banking", "secteur": self.fintech.id, "impact": "neutre",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["secteur_nom"], "FinTech")
        self.assertEqual(response.data["secteur_id"], self.fintech.id)
        self.assertEqual(response.data["secteur"], self.fintech.id)

    def test_secteur_inexistant(self):
        response = self.client.post(reverse("tendance-list"), {"titre": "X", "secteur": 9999}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("secteur", response.data)

    def test_filtres(self):
        liste = reverse("tendance-list")
        self.assertEqual([t["titre"] for t in self.client.get(liste, {"secteur": self.edtech.id}).data],
                         ["Hybride"])
        self.assertEqual([t["titre"] for t in self.client.get(liste, {"impact": "positif"}).data], ["Mobile"])
        self.assertEqual([t["titre"] for t in self.client.get(liste, {"ids": str(self.t2.id)}).data],
                         ["Hybride"])


class AnalyseSecteurTests(APITestCase):
    """GET /api/market/analyse/secteur/<id>/ : concurrents lus sur CONCURRENT-SERVICE."""

    def setUp(self):
        self.secteur = Secteur.objects.create(nom="FinTech")
        Tendance.objects.create(titre="T1", secteur=self.secteur, impact="positif")
        Tendance.objects.create(titre="T2", secteur=self.secteur, impact="positif")
        Tendance.objects.create(titre="T3", secteur=self.secteur, impact="negatif")
        self.url = reverse("analyse-secteur", args=[self.secteur.id])

    @mock.patch(DU_SECTEUR, return_value=[
        concurrent(1, "A", "10", "40"), concurrent(2, "B", "20", "25"),
        concurrent(3, "C", "30", "10"), concurrent(4, "D", "40", "5"),
    ])
    def test_analyse_secteur(self, du_secteur):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        du_secteur.assert_called_once_with(self.secteur.id)
        data = response.json()
        self.assertEqual(data["secteur"], {"id": self.secteur.id, "nom": "FinTech"})
        self.assertEqual(data["nombre_concurrents"], 4)
        self.assertEqual(data["prix_moyen"], 25.0)
        self.assertEqual(data["part_de_marche_totale"], 80.0)
        self.assertEqual(data["top_concurrents"][0]["part_de_marche"], 40.0)
        self.assertEqual([c["nom"] for c in data["top_concurrents"]], ["A", "B", "C"])
        self.assertEqual(data["tendances_positives"], 2)
        self.assertEqual(data["tendances_negatives"], 1)
        self.assertEqual(data["niveau_concurrence"], "eleve")

    @mock.patch(DU_SECTEUR, return_value=[])
    def test_secteur_sans_concurrent(self, du_secteur):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["nombre_concurrents"], 0)
        self.assertEqual(response.json()["prix_moyen"], 0.0)
        self.assertEqual(response.data["top_concurrents"], [])

    @mock.patch(DU_SECTEUR)
    def test_secteur_inexistant(self, du_secteur):
        response = self.client.get(reverse("analyse-secteur", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        du_secteur.assert_not_called()

    @mock.patch(DU_SECTEUR, side_effect=ServiceIndisponible("CONCURRENT-SERVICE"))
    def test_concurrent_service_indisponible(self, du_secteur):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "CONCURRENT-SERVICE", "message": "Service indisponible"})


class NiveauConcurrenceTests(APITestCase):
    def test_seuils(self):
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("10")), "faible")
        self.assertEqual(calculer_niveau_concurrence(3, Decimal("10")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("30")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(6, Decimal("0")), "eleve")
        self.assertEqual(calculer_niveau_concurrence(2, Decimal("60")), "eleve")


class DiversTests(APITestCase):
    def test_health(self):
        response = self.client.get("/api/market/secteurs/health/")
        self.assertEqual(response.json(), {"status": "UP", "service": "secteur-service"})

    def test_seed_idempotent(self):
        call_command("seed_secteurs", stdout=StringIO())
        call_command("seed_secteurs", stdout=StringIO())
        self.assertEqual(Secteur.objects.count(), 3)
        self.assertEqual(Tendance.objects.count(), 7)

    def test_swagger(self):
        self.assertEqual(self.client.get("/api/market/secteurs/docs/").status_code, 200)
        paths = self.client.get("/api/market/secteurs/schema/", {"format": "json"}).json()["paths"]
        for chemin in ["/api/market/secteurs/", "/api/market/tendances/",
                       "/api/market/analyse/secteur/{secteur_id}/", "/api/market/secteurs/health/"]:
            self.assertIn(chemin, paths)
