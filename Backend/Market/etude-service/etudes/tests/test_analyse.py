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
        self.a = d.concurrent("A", self.fintech, prix="20", part="10")
        self.b = d.concurrent("B", self.edtech, prix="40", part="35")
        # Concurrent du secteur FinTech NON associé aux études : ne doit pas être compté
        d.concurrent("Non associé", self.fintech, part="50")
        self.mobile = d.tendance("Mobile", self.fintech, "positif")
        d.tendance("Régulation", self.fintech, "negatif")  # non retenue dans l'étude FinTech
        self.hybride = d.tendance("Hybride", self.edtech, "positif")
        self.etude_fintech = EtudeMarche.objects.create(
            projet_id=42, secteur_id=self.fintech, titre="Étude FinTech",
            taille_marche=Decimal("1000000"), taux_croissance=Decimal("12.5"), prix_propose=Decimal("15"),
            concurrent_ids=[self.a], tendance_ids=[self.mobile],
        )
        # Aucune tendance retenue : on garde celles du secteur EdTech
        self.etude_edtech = EtudeMarche.objects.create(
            projet_id=42, secteur_id=self.edtech, titre="Étude EdTech", concurrent_ids=[self.b])
        # Étude d'un autre projet : ne doit pas apparaître
        EtudeMarche.objects.create(projet_id=7, secteur_id=self.fintech, titre="Autre")

    def analyse(self, projet_id=42):
        response = self.client.get(reverse("analyse-projet", args=[projet_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def test_analyse_projet(self):
        data = self.analyse()
        self.assertEqual(data["projet_id"], 42)
        self.assertEqual(data["nombre_etudes"], 2)
        self.assertEqual(len(data["secteurs"]), 2)
        # Listes globales : concurrents ASSOCIÉS aux études ("Non associé" exclu)
        self.assertEqual(sorted(c["nom"] for c in data["concurrents"]), ["A", "B"])
        self.assertEqual(sorted(t["titre"] for t in data["tendances"]), ["Hybride", "Mobile"])
        etude_fintech = next(e for e in data["etudes"] if e["secteur"] == "FinTech")
        self.assertEqual(etude_fintech["taux_croissance"], 12.5)

        par_nom = {s["nom"]: s for s in data["secteurs"]}
        self.assertEqual(par_nom["FinTech"]["nombre_concurrents"], 1)
        self.assertEqual(par_nom["FinTech"]["niveau_concurrence"], "faible")
        self.assertEqual(par_nom["EdTech"]["niveau_concurrence"], "moyen")
        # Le niveau global est le plus élevé des secteurs
        self.assertEqual(data["niveau_concurrence"], "moyen")

    def test_meme_niveau_que_la_page_de_l_etude(self):
        data = self.analyse()
        par_nom = {s["nom"]: s for s in data["secteurs"]}
        for etude, secteur in ((self.etude_fintech, "FinTech"), (self.etude_edtech, "EdTech")):
            page = self.client.get(reverse("etude-opportunites-menaces", args=[etude.id])).json()
            self.assertEqual(par_nom[secteur]["niveau_concurrence"], page["niveau_concurrence"])

    def test_concurrent_retire_n_est_plus_compte(self):
        avant = next(s for s in self.analyse()["secteurs"] if s["nom"] == "EdTech")
        self.assertEqual(avant["nombre_concurrents"], 1)
        response = self.client.patch(reverse("etude-detail", args=[self.etude_edtech.id]),
                                     {"concurrent_ids": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = self.analyse()
        self.assertEqual([c["nom"] for c in data["concurrents"]], ["A"])
        edtech = next(s for s in data["secteurs"] if s["nom"] == "EdTech")
        self.assertEqual(edtech["nombre_concurrents"], 0)
        self.assertEqual(edtech["niveau_concurrence"], "inconnu")
        self.assertEqual(data["niveau_concurrence"], "faible")

    def test_projet_sans_concurrent_inconnu(self):
        # Études présentes mais aucun concurrent associé : "inconnu" (et non "faible")
        EtudeMarche.objects.filter(projet_id=42).update(concurrent_ids=[])
        data = self.analyse()
        self.assertEqual(data["concurrents"], [])
        self.assertEqual({s["niveau_concurrence"] for s in data["secteurs"]}, {"inconnu"})
        self.assertEqual(data["niveau_concurrence"], "inconnu")
        self.assertTrue(all(e["prix_moyen_concurrents"] is None for e in data["etudes"]))
        self.mocks["concurrent_list"].assert_not_called()  # aucun id à lire : aucun appel

    def test_tendances_des_etudes_sinon_du_secteur(self):
        par_nom = {s["nom"]: s for s in self.analyse()["secteurs"]}
        # FinTech : seulement la tendance retenue ("Régulation" exclue)
        self.assertEqual([t["titre"] for t in par_nom["FinTech"]["tendances"]], ["Mobile"])
        self.assertEqual(par_nom["FinTech"]["source_tendances"], "etudes")
        # EdTech : aucune retenue -> tendances du secteur
        self.assertEqual([t["titre"] for t in par_nom["EdTech"]["tendances"]], ["Hybride"])
        self.assertEqual(par_nom["EdTech"]["source_tendances"], "secteur")

    def test_prix_par_etude(self):
        etudes = {e["titre"]: e for e in self.analyse()["etudes"]}
        fintech = etudes["Étude FinTech"]
        # 15 face à une moyenne de 20 : -25 % -> économique
        self.assertEqual(fintech["prix_propose"], 15.0)
        self.assertEqual(fintech["prix_moyen_concurrents"], 20.0)
        self.assertEqual(fintech["ecart_pourcentage"], -25.0)
        self.assertEqual(fintech["positionnement"], "economique")
        # Pas de prix proposé : écart null, positionnement inconnu, prix moyen quand même donné
        edtech = etudes["Étude EdTech"]
        self.assertIsNone(edtech["prix_propose"])
        self.assertEqual(edtech["prix_moyen_concurrents"], 40.0)
        self.assertIsNone(edtech["ecart_pourcentage"])
        self.assertEqual(edtech["positionnement"], "inconnu")

    def test_prix_identique_a_comparaison_prix(self):
        fintech = next(e for e in self.analyse()["etudes"] if e["titre"] == "Étude FinTech")
        comparaison = self.client.get(reverse("etude-comparaison-prix", args=[self.etude_fintech.id])).json()
        self.assertEqual(fintech["prix_moyen_concurrents"], comparaison["prix_moyen"])
        self.assertEqual(fintech["ecart_pourcentage"], comparaison["ecart_moyenne_pct"])
        self.assertEqual(fintech["positionnement"], comparaison["positionnement"])

    def test_compatibilite_des_cles(self):
        # Le AI-Service lit ces clés : elles restent présentes (on ne fait qu'en ajouter)
        data = self.analyse()
        self.assertLessEqual({"projet_id", "nombre_etudes", "etudes", "secteurs", "concurrents", "tendances",
                              "niveau_concurrence"}, set(data))
        self.assertLessEqual({"id", "titre", "secteur", "taille_marche", "taux_croissance", "cible",
                              "zone_geographique"}, set(data["etudes"][0]))
        self.assertLessEqual({"id", "nom", "nombre_concurrents", "part_de_marche_cumulee", "niveau_concurrence",
                              "concurrents", "tendances"}, set(data["secteurs"][0]))

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
        # Les études ont des concurrents associés : CONCURRENT-SERVICE est appelé
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
        self.assertEqual(calculer_niveau_concurrence(0, Decimal("0")), "inconnu")


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
