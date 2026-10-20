"""Tests de l'API du Market-Service."""

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Concurrent, EtudeMarche, Secteur, Tendance
from .services import calculer_niveau_concurrence


class ConcurrentCrudTests(APITestCase):
    """CRUD complet sur /api/market/concurrents/."""

    def setUp(self):
        self.fintech = Secteur.objects.create(nom="FinTech")
        self.edtech = Secteur.objects.create(nom="EdTech")
        self.c1 = Concurrent.objects.create(
            nom="Flouci", secteur=self.fintech, pays="Tunisie",
            prix_moyen=Decimal("10"), part_de_marche=Decimal("20"),
        )
        self.c2 = Concurrent.objects.create(
            nom="Coursera", secteur=self.edtech, pays="États-Unis",
            prix_moyen=Decimal("45"), part_de_marche=Decimal("30"),
        )
        self.liste_url = reverse("concurrent-list")

    def detail_url(self, pk):
        return reverse("concurrent-detail", args=[pk])

    def test_lister(self):
        response = self.client.get(self.liste_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_creer(self):
        data = {
            "nom": "Konnect", "secteur": self.fintech.id, "pays": "Tunisie",
            "prix_moyen": "25.00", "part_de_marche": "12.50",
        }
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["secteur_nom"], "FinTech")
        self.assertEqual(Concurrent.objects.count(), 3)

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

    def test_modifier(self):
        response = self.client.patch(
            self.detail_url(self.c1.id), {"part_de_marche": "22.00"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.c1.refresh_from_db()
        self.assertEqual(self.c1.part_de_marche, Decimal("22.00"))

    def test_supprimer(self):
        response = self.client.delete(self.detail_url(self.c1.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Concurrent.objects.filter(id=self.c1.id).exists())

    def test_part_de_marche_invalide(self):
        data = {"nom": "X", "secteur": self.fintech.id, "part_de_marche": "120"}
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("part_de_marche", response.data)

    def test_prix_negatif_invalide(self):
        data = {"nom": "X", "secteur": self.fintech.id, "prix_moyen": "-5"}
        response = self.client.post(self.liste_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prix_moyen", response.data)

    def test_filtre_secteur(self):
        response = self.client.get(self.liste_url, {"secteur": self.fintech.id})
        self.assertEqual([c["nom"] for c in response.data], ["Flouci"])

    def test_filtre_pays(self):
        response = self.client.get(self.liste_url, {"pays": "tunisie"})
        self.assertEqual([c["nom"] for c in response.data], ["Flouci"])

    def test_recherche_nom(self):
        response = self.client.get(self.liste_url, {"search": "cours"})
        self.assertEqual([c["nom"] for c in response.data], ["Coursera"])


class AnalyseSecteurTests(APITestCase):
    """GET /api/market/analyse/secteur/<id>/"""

    def setUp(self):
        self.secteur = Secteur.objects.create(nom="FinTech")
        for nom, prix, part in [("A", "10", "40"), ("B", "20", "25"),
                                ("C", "30", "10"), ("D", "40", "5")]:
            Concurrent.objects.create(
                nom=nom, secteur=self.secteur,
                prix_moyen=Decimal(prix), part_de_marche=Decimal(part),
            )
        Tendance.objects.create(titre="T1", secteur=self.secteur, impact="positif")
        Tendance.objects.create(titre="T2", secteur=self.secteur, impact="positif")
        Tendance.objects.create(titre="T3", secteur=self.secteur, impact="negatif")

    def test_analyse_secteur(self):
        url = reverse("analyse-secteur", args=[self.secteur.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["nombre_concurrents"], 4)
        self.assertEqual(data["prix_moyen"], 25.0)
        self.assertEqual(data["part_de_marche_totale"], 80.0)
        self.assertEqual(data["top_concurrents"][0]["part_de_marche"], 40.0)
        self.assertEqual([c["nom"] for c in data["top_concurrents"]], ["A", "B", "C"])
        self.assertEqual(data["tendances_positives"], 2)
        self.assertEqual(data["tendances_negatives"], 1)
        self.assertEqual(data["niveau_concurrence"], "eleve")

    def test_secteur_vide(self):
        vide = Secteur.objects.create(nom="Vide")
        response = self.client.get(reverse("analyse-secteur", args=[vide.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["nombre_concurrents"], 0)
        self.assertEqual(response.json()["prix_moyen"], 0.0)
        self.assertEqual(response.data["top_concurrents"], [])

    def test_secteur_inexistant(self):
        response = self.client.get(reverse("analyse-secteur", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class AnalyseProjetTests(APITestCase):
    """GET /api/market/analyse/projet/<projet_id>/"""

    def setUp(self):
        self.fintech = Secteur.objects.create(nom="FinTech")
        self.edtech = Secteur.objects.create(nom="EdTech")
        Concurrent.objects.create(nom="A", secteur=self.fintech, part_de_marche=Decimal("10"))
        Concurrent.objects.create(nom="B", secteur=self.edtech, part_de_marche=Decimal("35"))
        Tendance.objects.create(titre="Mobile", secteur=self.fintech, impact="positif")
        EtudeMarche.objects.create(
            projet_id=42, secteur=self.fintech, titre="Étude FinTech",
            taille_marche=Decimal("1000000"), taux_croissance=Decimal("12.5"),
        )
        EtudeMarche.objects.create(
            projet_id=42, secteur=self.edtech, titre="Étude EdTech",
        )
        # Étude d'un autre projet : ne doit pas apparaître
        EtudeMarche.objects.create(projet_id=7, secteur=self.fintech, titre="Autre")

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
        # Un projet sans étude n'est pas une erreur : 200 + structure vide
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

    def test_meme_structure_avec_ou_sans_etude(self):
        # Le AI-Service peut lire les mêmes clés dans les deux cas
        avec = self.client.get(reverse("analyse-projet", args=[42])).json()
        sans = self.client.get(reverse("analyse-projet", args=[999])).json()
        self.assertEqual(set(avec.keys()), set(sans.keys()))

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
        response = self.client.get(reverse("health"))
        self.assertEqual(response.json(), {"status": "UP", "service": "market-service"})

    def test_seed_idempotent(self):
        # Deux exécutions successives ne doivent pas créer de doublons
        call_command("seed_marche", stdout=StringIO())
        call_command("seed_marche", stdout=StringIO())
        self.assertEqual(Secteur.objects.count(), 3)
        self.assertEqual(Concurrent.objects.count(), 10)

    def test_schema_swagger(self):
        response = self.client.get(reverse("schema"), {"format": "json"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get(reverse("swagger-ui")).status_code, 200)
        schemas = response.json()["components"]["schemas"]
        # "inconnu" fait partie des niveaux documentés
        self.assertIn("inconnu", schemas["NiveauConcurrenceEnum"]["enum"])
        # Les décimaux du CRUD sont documentés comme des nombres
        self.assertEqual(schemas["Concurrent"]["properties"]["prix_moyen"]["type"], "number")
