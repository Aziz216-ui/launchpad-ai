"""Tests de GET /api/market/analyse/projet/<projet_id>/ (consommé par le AI-Service)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clients import ServiceIndisponible
from etudes.models import EtudeMarche
from etudes.services import calculer_niveau_concurrence

from .faux_services import FauxServices


class AnalyseProjetTests(APITestCase):
    def setUp(self):
        self.distant = FauxServices()
        self.mocks = self.distant.demarrer(self)
        d = self.distant
        self.fintech = d.secteur("FinTech")
        self.edtech = d.secteur("EdTech")
        d.concurrent("A", self.fintech, part="10")
        d.concurrent("B", self.edtech, part="35")
        d.tendance("Mobile", self.fintech, "positif")
        EtudeMarche.objects.create(
            projet_id=42, secteur_id=self.fintech, titre="Étude FinTech",
            taille_marche=Decimal("1000000"), taux_croissance=Decimal("12.5"),
        )
        EtudeMarche.objects.create(projet_id=42, secteur_id=self.edtech, titre="Étude EdTech")
        # Étude d'un autre projet : ne doit pas apparaître
        EtudeMarche.objects.create(projet_id=7, secteur_id=self.fintech, titre="Autre")

    def test_analyse_projet(self):
        response = self.client.get(reverse("analyse-projet", args=[42]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["projet_id"], 42)
        self.assertEqual(data["nombre_etudes"], 2)
        self.assertEqual(len(data["secteurs"]), 2)
        # Listes globales : concurrents et tendances de tous les secteurs du projet
        self.assertEqual(sorted(c["nom"] for c in data["concurrents"]), ["A", "B"])
        self.assertEqual([t["titre"] for t in data["tendances"]], ["Mobile"])
        etude_fintech = next(e for e in data["etudes"] if e["secteur"] == "FinTech")
        self.assertEqual(etude_fintech["taux_croissance"], 12.5)

        par_nom = {s["nom"]: s for s in data["secteurs"]}
        self.assertEqual(par_nom["FinTech"]["nombre_concurrents"], 1)
        self.assertEqual(par_nom["FinTech"]["niveau_concurrence"], "faible")
        self.assertEqual(len(par_nom["FinTech"]["tendances"]), 1)
        self.assertEqual(par_nom["EdTech"]["niveau_concurrence"], "moyen")
        # Le niveau global est le plus élevé des secteurs
        self.assertEqual(data["niveau_concurrence"], "moyen")

    def test_projet_sans_etude(self):
        # Un projet sans étude n'est pas une erreur : 200 + structure vide, aucun appel distant
        response = self.client.get(reverse("analyse-projet", args=[999]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {
            "projet_id": 999,
            "nombre_etudes": 0,
            "etudes": [],
            "secteurs": [],
            "concurrents": [],
            "tendances": [],
            "niveau_concurrence": "inconnu",
        })
        self.mocks["secteur_list"].assert_not_called()

    def test_meme_structure_avec_ou_sans_etude(self):
        # Le AI-Service peut lire les mêmes clés dans les deux cas
        avec = self.client.get(reverse("analyse-projet", args=[42])).json()
        sans = self.client.get(reverse("analyse-projet", args=[999])).json()
        self.assertEqual(set(avec.keys()), set(sans.keys()))

    def test_secteur_supprime(self):
        del self.distant.secteurs[self.edtech]
        data = self.client.get(reverse("analyse-projet", args=[42])).json()
        self.assertEqual([s["nom"] for s in data["secteurs"]], ["FinTech"])
        self.assertIn(None, [e["secteur"] for e in data["etudes"]])

    def test_service_indisponible(self):
        self.mocks["concurrent_list"].side_effect = ServiceIndisponible("CONCURRENT-SERVICE")
        response = self.client.get(reverse("analyse-projet", args=[42]))
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "CONCURRENT-SERVICE", "message": "Service indisponible"})

    def test_filtre_etudes_par_projet(self):
        response = self.client.get(reverse("etude-list"), {"projet_id": 42})
        self.assertEqual(len(response.data), 2)


class NiveauConcurrenceTests(APITestCase):
    def test_seuils(self):
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("10")), "faible")
        self.assertEqual(calculer_niveau_concurrence(3, Decimal("10")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("30")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(6, Decimal("0")), "eleve")
        self.assertEqual(calculer_niveau_concurrence(2, Decimal("60")), "eleve")


class DiversTests(APITestCase):
    def test_health(self):
        response = self.client.get("/api/market/etudes/health/")
        self.assertEqual(response.json(), {"status": "UP", "service": "etude-service"})

    def test_swagger(self):
        self.assertEqual(self.client.get("/api/market/etudes/docs/").status_code, 200)
        response = self.client.get("/api/market/etudes/schema/", {"format": "json"})
        paths = response.json()["paths"]
        for chemin in [
            "/api/market/etudes/", "/api/market/personas/", "/api/market/analyse/projet/{projet_id}/",
            "/api/market/etudes/{id}/finaliser/", "/api/market/etudes/{id}/comparaison-prix/",
            "/api/market/etudes/{id}/opportunites-menaces/",
            "/api/market/etudes/{id}/rapport/", "/api/market/etudes/{id}/rapport/pdf/",
        ]:
            self.assertIn(chemin, paths)
        schemas = response.json()["components"]["schemas"]
        self.assertIn("inconnu", schemas["NiveauConcurrenceEnum"]["enum"])
