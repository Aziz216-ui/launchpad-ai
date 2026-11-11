"""
Tests de la gestion de l'étude de marché (personas, prix, opportunités/menaces, rapport),
repris de l'ancien Market-Service avec les services distants simulés (faux_services.py).
"""

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
from etudes.models import EtudeMarche, Persona
from market_commun.evenements.models import EvenementOutbox

from .faux_services import FauxServices


class EtudeBaseTestCase(APITestCase):
    """Une étude FinTech avec 4 concurrents (prix moyen 20, part cumulée 65 %) et 3 tendances."""

    def setUp(self):
        self.distant = FauxServices()
        self.mocks = self.distant.demarrer(self)
        d = self.distant
        self.secteur = d.secteur("FinTech")
        self.concurrents = [
            d.concurrent(nom, self.secteur, prix, part)
            for nom, prix, part in [("A", "10", "30"), ("B", "30", "20"), ("C", "20", "10"), ("D", "20", "5")]
        ]
        self.positive = d.tendance("Mobile", self.secteur, "positif", "En hausse")
        self.negative = d.tendance("Régulation", self.secteur, "negatif")
        self.neutre = d.tendance("Open banking", self.secteur, "neutre")
        self.etude = EtudeMarche.objects.create(
            projet_id=1, entrepreneur_id=10, secteur_id=self.secteur, titre="Paiement PME",
            taux_croissance=Decimal("12.5"), prix_propose=Decimal("16"),
            description_offre="QR code", hypotheses="Les PME paient une commission",
            concurrent_ids=self.concurrents, tendance_ids=[self.positive, self.negative, self.neutre],
        )

    def url(self, nom, etude=None):
        return reverse(f"etude-{nom}", args=[(etude or self.etude).id])


class EtudeCrudTests(EtudeBaseTestCase):
    def test_creer_avec_concurrents_et_tendances(self):
        data = {
            "projet_id": 5, "entrepreneur_id": 42, "secteur": self.secteur,
            "titre": "Nouvelle étude", "cible": "PME", "zone_geographique": "Tunisie",
            "hypotheses": "H1", "description_offre": "Offre", "prix_propose": "12.50",
            "concurrents": [self.concurrents[0], self.concurrents[1]],
            "tendances": [self.positive],
        }
        response = self.client.post(reverse("etude-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["statut"], "brouillon")
        self.assertEqual(sorted(response.data["concurrents"]), sorted(self.concurrents[:2]))
        self.assertEqual(response.data["concurrent_ids"], response.data["concurrents"])
        self.assertEqual(response.data["secteur_nom"], "FinTech")
        etude = EtudeMarche.objects.get(id=response.data["id"])
        self.assertEqual(etude.tendance_ids, [self.positive])
        # Sans jeton (appel interne) : la valeur envoyée est gardée, en chaîne (identifiant Keycloak)
        self.assertEqual(etude.entrepreneur_id, "42")

    def test_creer_sans_nouveaux_champs(self):
        # Compatibilité : le format de création d'origine reste valide
        data = {"projet_id": 1, "secteur": self.secteur, "titre": "Ancien format"}
        response = self.client.post(reverse("etude-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["entrepreneur_id"])
        self.assertEqual(response.data["concurrents"], [])

    def test_format_compatible_avec_l_ancien_service(self):
        data = self.client.get(reverse("etude-list")).json()[0]
        anciens = {"id", "projet_id", "entrepreneur_id", "statut", "secteur", "secteur_nom", "titre",
                   "taille_marche", "taux_croissance", "cible", "zone_geographique", "hypotheses",
                   "description_offre", "prix_propose", "concurrents", "tendances",
                   "date_creation", "date_mise_a_jour"}
        self.assertEqual(set(data), anciens | {"secteur_id", "concurrent_ids", "tendance_ids"})

    def test_secteur_absent_400(self):
        response = self.client.post(reverse("etude-list"),
                                    {"projet_id": 1, "secteur_id": 9999, "titre": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"secteur_id": ["Secteur introuvable"]})

    def test_secteur_service_indisponible_503(self):
        self.mocks["secteur_exists"].side_effect = ServiceIndisponible("SECTEUR-SERVICE")
        response = self.client.post(reverse("etude-list"),
                                    {"projet_id": 1, "secteur_id": self.secteur, "titre": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "SECTEUR-SERVICE", "message": "Service indisponible"})

    def test_statut_non_modifiable_directement(self):
        response = self.client.patch(self.url("detail"), {"statut": "finalisee"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.statut, "brouillon")

    def test_modifier_criteres_marche_et_hypotheses(self):
        response = self.client.patch(self.url("detail"), {
            "cible": "Commerçants", "zone_geographique": "Sfax", "hypotheses": "H2",
            "concurrents": [self.concurrents[2]],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.cible, "Commerçants")
        self.assertEqual(self.etude.hypotheses, "H2")
        self.assertEqual(self.etude.concurrent_ids, [self.concurrents[2]])

    def test_detail_inclut_elements_lies(self):
        Persona.objects.create(etude=self.etude, nom="Sami")
        self.distant.swot.append({"id": 1, "etude": self.etude.id, "etude_id": self.etude.id, "type": "force",
                                  "description": "Équipe", "genere_automatiquement": False})
        data = self.client.get(self.url("detail")).json()
        self.assertEqual([p["nom"] for p in data["personas"]], ["Sami"])
        self.assertEqual([s["description"] for s in data["swot"]], ["Équipe"])
        self.assertEqual(len(data["concurrents_details"]), 4)
        self.assertEqual(data["concurrents_details"][0]["secteur_nom"], "FinTech")
        self.assertEqual(len(data["tendances_details"]), 3)
        # Un seul appel à CONCURRENT-SERVICE pour tous les concurrents de l'étude
        self.assertEqual(self.mocks["concurrent_list"].call_count, 1)

    def test_concurrent_inexistant(self):
        response = self.client.patch(self.url("detail"), {"concurrents": [9999]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"concurrent_ids": ["Concurrent(s) introuvable(s) : 9999"]})

    def test_tendance_inexistante(self):
        response = self.client.patch(self.url("detail"), {"tendance_ids": [self.positive, 8888]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"tendance_ids": ["Tendance(s) introuvable(s) : 8888"]})

    def test_concurrent_service_indisponible_503(self):
        self.mocks["concurrent_list"].side_effect = ServiceIndisponible("CONCURRENT-SERVICE")
        response = self.client.patch(self.url("detail"), {"concurrents": [self.concurrents[0], 7777]},
                                     format="json")
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json()["service"], "CONCURRENT-SERVICE")

    def test_prix_propose_negatif(self):
        response = self.client.patch(self.url("detail"), {"prix_propose": "-1"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prix_propose", response.data)

    def test_filtres_entrepreneur_et_statut(self):
        EtudeMarche.objects.create(projet_id=2, entrepreneur_id=11, secteur_id=self.secteur,
                                   titre="Autre", statut="finalisee")
        liste = reverse("etude-list")
        self.assertEqual([e["titre"] for e in self.client.get(liste, {"entrepreneur_id": 10}).data],
                         ["Paiement PME"])
        self.assertEqual([e["titre"] for e in self.client.get(liste, {"statut": "finalisee"}).data],
                         ["Autre"])
        self.assertEqual([e["titre"] for e in self.client.get(liste, {"ids": str(self.etude.id)}).data],
                         ["Paiement PME"])

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_supprimer_brouillon_supprime_personas_et_publie_etude_supprimee(self, envoyer):
        Persona.objects.create(etude=self.etude, nom="Sami")
        with self.assertLogs("market_commun.evenements.producteur", "INFO") as logs, self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url("detail"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Persona.objects.count(), 0)
        # La SWOT est supprimée par SWOT-SERVICE à la réception de l'événement (asynchrone)
        message = envoyer.call_args.args[0]
        self.assertEqual(message["event"], "etude.supprimee")
        self.assertEqual(message["data"], {"etude_id": self.etude.id, "projet_id": 1})
        self.assertIn(f"[PRODUCER] etude.supprimee etude_id={self.etude.id}", logs.output[0])

    @mock.patch("market_commun.evenements.producteur.envoyer", side_effect=ConnectionError("RabbitMQ arrêté"))
    def test_supprimer_meme_si_rabbitmq_est_arrete(self, envoyer):
        with self.assertLogs("market_commun.evenements.producteur", "ERROR"), self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.url("detail"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(EtudeMarche.objects.exists())
        # Renvoyé plus tard par le relais de l'outbox
        self.assertEqual(EvenementOutbox.objects.get().routing_key, "etude.supprimee")

    def test_secteur_supprime_secteur_nom_null(self):
        del self.distant.secteurs[self.secteur]
        data = self.client.get(reverse("etude-list")).json()
        self.assertIsNone(data[0]["secteur_nom"])
        rapport = self.client.get(self.url("rapport"))
        self.assertEqual(rapport.status_code, status.HTTP_200_OK)
        self.assertIsNone(rapport.json()["marche_cible"]["secteur"]["nom"])

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_finaliser(self, envoyer):
        with self.assertLogs("market_commun.evenements.producteur", "INFO"), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url("finaliser"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "finalisee")
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.statut, "finalisee")
        # etude.finalisee publié : SWOT-SERVICE génère la SWOT
        message = envoyer.call_args.args[0]
        self.assertEqual((message["event"], message["data"]), ("etude.finalisee", {"etude_id": self.etude.id,
                                                                                  "projet_id": 1}))
        # Idempotent : une 2e finalisation ne republie pas
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(self.url("finaliser")).status_code, status.HTTP_200_OK)
        envoyer.assert_called_once()

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_modification_ne_publie_rien(self, envoyer):
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(self.url("detail"), {"cible": "PME"}, format="json")
        envoyer.assert_not_called()

    def test_etude_sans_secteur_lisible(self):
        # secteur_id remis à null par l'événement secteur.supprime
        self.etude.secteur_id = None
        self.etude.save()
        self.assertIsNone(self.client.get(reverse("etude-list")).json()[0]["secteur_nom"])
        rapport = self.client.get(self.url("rapport"))
        self.assertEqual(rapport.status_code, status.HTTP_200_OK)
        self.assertEqual(rapport.json()["marche_cible"]["secteur"], {"id": None, "nom": None})

    def test_finaliser_etude_inexistante(self):
        response = self.client.post(reverse("etude-finaliser", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CoherenceSecteurTests(EtudeBaseTestCase):
    """Concurrents et tendances d'une étude : toujours du secteur de l'étude."""

    def setUp(self):
        super().setUp()
        d = self.distant
        self.edtech = d.secteur("EdTech")
        self.concurrent_edtech = d.concurrent("Coursera", self.edtech, "50", "40")
        self.tendance_edtech = d.tendance("Hybride", self.edtech, "positif")

    def test_creation_concurrent_d_un_autre_secteur_400(self):
        data = {"projet_id": 5, "secteur": self.secteur, "titre": "X",
                "concurrent_ids": [self.concurrents[0], self.concurrent_edtech]}
        response = self.client.post(reverse("etude-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"concurrent_ids": [
            f"Concurrent(s) hors du secteur de l'étude : {self.concurrent_edtech}"]})
        self.assertFalse(EtudeMarche.objects.filter(titre="X").exists())

    def test_modification_ajout_d_un_concurrent_d_un_autre_secteur_400(self):
        response = self.client.patch(self.url("detail"),
                                     {"concurrent_ids": [*self.concurrents, self.concurrent_edtech]},
                                     format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("hors du secteur", response.json()["concurrent_ids"][0])
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.concurrent_ids, self.concurrents)

    def test_tendance_d_un_autre_secteur_400(self):
        response = self.client.patch(self.url("detail"), {"tendance_ids": [self.tendance_edtech]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"tendance_ids": [
            f"Tendance(s) hors du secteur de l'étude : {self.tendance_edtech}"]})

    def test_changement_de_secteur_retire_concurrents_et_tendances(self):
        response = self.client.patch(self.url("detail"), {"secteur": self.edtech}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["secteur_id"], self.edtech)
        self.assertEqual(response.data["concurrent_ids"], [])
        self.assertEqual(response.data["concurrents_retires"], self.concurrents)
        self.assertEqual(response.data["tendances_retirees"], [self.positive, self.negative, self.neutre])
        self.etude.refresh_from_db()
        self.assertEqual((self.etude.concurrent_ids, self.etude.tendance_ids), ([], []))

    def test_changement_de_secteur_avec_concurrents_du_nouveau_secteur(self):
        # Ancien concurrent gardé dans la requête -> retiré ; nouveau du bon secteur -> accepté
        response = self.client.patch(self.url("detail"), {
            "secteur": self.edtech, "concurrent_ids": [self.concurrents[0], self.concurrent_edtech],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["concurrent_ids"], [self.concurrent_edtech])
        self.assertEqual(response.data["concurrents_retires"], [self.concurrents[0]])

    def test_changement_de_secteur_niveau_recalcule(self):
        self.client.patch(self.url("detail"), {"secteur": self.edtech}, format="json")
        niveau = self.client.get(self.url("opportunites-menaces")).json()["niveau_concurrence"]
        self.assertEqual(niveau, "inconnu")

    def test_modification_sans_changement_de_secteur(self):
        # Rien de retiré ; les ids déjà associés ne sont pas relus (aucun appel de validation)
        self.mocks["concurrent_list"].reset_mock()
        response = self.client.patch(self.url("detail"), {"cible": "PME"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.mocks["concurrent_list"].call_count, 0)
        self.assertEqual(response.data["concurrents_retires"], [])
        self.assertEqual(response.data["tendances_retirees"], [])
        self.assertEqual(response.data["concurrent_ids"], self.concurrents)

    def test_lecture_sans_champs_de_retrait(self):
        # Les champs *_retires n'apparaissent qu'en réponse à une écriture
        self.assertNotIn("concurrents_retires", self.client.get(self.url("detail")).json())
        self.assertNotIn("concurrents_retires", self.client.get(reverse("etude-list")).json()[0])


class PersonaCrudTests(EtudeBaseTestCase):
    def test_crud(self):
        liste = reverse("persona-list")
        response = self.client.post(liste, {
            "etude": self.etude.id, "nom": "Sami", "tranche_age": "35-50 ans",
            "profession": "Épicier", "localisation": "Tunis", "revenu_estime": "2500",
            "besoins": "Encaisser vite", "frustrations": "Espèces",
            "comportement_achat": "Bouche-à-oreille",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        pk = response.data["id"]
        self.assertEqual(response.json()["revenu_estime"], 2500.0)
        self.assertEqual(response.data["etude_id"], self.etude.id)

        detail = reverse("persona-detail", args=[pk])
        self.assertEqual(self.client.get(detail).data["nom"], "Sami")
        response = self.client.patch(detail, {"profession": "Grossiste"}, format="json")
        self.assertEqual(response.data["profession"], "Grossiste")
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Persona.objects.exists())

    def test_filtre_etude(self):
        autre = EtudeMarche.objects.create(projet_id=2, secteur_id=self.secteur, titre="Autre")
        Persona.objects.create(etude=self.etude, nom="P1")
        Persona.objects.create(etude=autre, nom="P2")
        response = self.client.get(reverse("persona-list"), {"etude": autre.id})
        self.assertEqual([p["nom"] for p in response.data], ["P2"])

    def test_etude_inexistante(self):
        response = self.client.post(reverse("persona-list"), {"etude": 9999, "nom": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("etude", response.data)

    def test_revenu_negatif_invalide(self):
        response = self.client.post(reverse("persona-list"), {
            "etude": self.etude.id, "nom": "X", "revenu_estime": "-10",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("revenu_estime", response.data)


class ComparaisonPrixTests(EtudeBaseTestCase):
    def test_comparaison(self):
        response = self.client.get(self.url("comparaison-prix"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["prix_propose"], 16.0)
        self.assertEqual(data["nombre_concurrents"], 4)
        self.assertEqual((data["prix_min"], data["prix_moyen"], data["prix_max"]), (10.0, 20.0, 30.0))
        self.assertEqual(data["ecart_moyenne_pct"], -20.0)
        self.assertEqual(data["positionnement"], "economique")
        # Triés par prix croissant puis par nom
        self.assertEqual([c["nom"] for c in data["concurrents"]], ["A", "C", "D", "B"])

    def test_positionnements(self):
        for prix, attendu in [("21", "aligne"), ("18", "aligne"), ("23", "premium")]:
            self.etude.prix_propose = Decimal(prix)
            self.etude.save()
            data = self.client.get(self.url("comparaison-prix")).json()
            self.assertEqual(data["positionnement"], attendu, prix)

    def test_sans_prix_ou_sans_concurrent(self):
        self.etude.prix_propose = None
        self.etude.save()
        data = self.client.get(self.url("comparaison-prix")).json()
        self.assertEqual(data["positionnement"], "inconnu")
        self.assertIsNone(data["ecart_moyenne_pct"])
        self.assertEqual(data["prix_moyen"], 20.0)

        self.etude.concurrent_ids = []
        self.etude.save()
        data = self.client.get(self.url("comparaison-prix")).json()
        self.assertEqual(data["nombre_concurrents"], 0)
        self.assertIsNone(data["prix_moyen"])
        self.assertEqual(data["concurrents"], [])

    def test_concurrent_supprime_ignore(self):
        del self.distant.concurrents[self.concurrents[1]]  # B (30) supprimé dans CONCURRENT-SERVICE
        data = self.client.get(self.url("comparaison-prix")).json()
        self.assertEqual(data["nombre_concurrents"], 3)
        self.assertEqual(data["prix_max"], 20.0)

    def test_concurrent_service_indisponible(self):
        self.mocks["concurrent_list"].side_effect = ServiceIndisponible("CONCURRENT-SERVICE")
        response = self.client.get(self.url("comparaison-prix"))
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "CONCURRENT-SERVICE", "message": "Service indisponible"})


class OpportunitesMenacesTests(EtudeBaseTestCase):
    def test_opportunites_menaces(self):
        response = self.client.get(self.url("opportunites-menaces"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        # 4 concurrents, 65 % de part cumulée -> concurrence élevée
        self.assertEqual(data["niveau_concurrence"], "eleve")
        self.assertEqual(data["positionnement_prix"], "economique")
        sources_o = sorted(e["source"] for e in data["opportunites"])
        sources_m = sorted(e["source"] for e in data["menaces"])
        self.assertEqual(sources_o, ["croissance", "prix", "tendance"])
        self.assertEqual(sources_m, ["concurrence", "tendance"])
        self.assertIn("Mobile : En hausse", [e["description"] for e in data["opportunites"]])

    def test_marche_en_recul_et_prix_premium(self):
        self.etude.taux_croissance = Decimal("-3")
        self.etude.prix_propose = Decimal("50")
        self.etude.concurrent_ids = self.concurrents[2:]  # 2 concurrents, 15 % -> faible
        self.etude.save()
        data = self.client.get(self.url("opportunites-menaces")).json()
        self.assertEqual(data["niveau_concurrence"], "faible")
        self.assertIn("concurrence", [e["source"] for e in data["opportunites"]])
        self.assertEqual(sorted(e["source"] for e in data["menaces"]),
                         ["croissance", "prix", "tendance"])


class RapportTests(EtudeBaseTestCase):
    def test_rapport_json(self):
        Persona.objects.create(etude=self.etude, nom="Sami", revenu_estime=Decimal("2500"))
        self.distant.apercu = [{"type": "opportunite", "description": "Mobile : En hausse"}]
        response = self.client.get(self.url("rapport"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(set(data), {
            "etude", "marche_cible", "hypotheses", "offre", "tendances", "concurrents",
            "comparaison_prix", "personas", "opportunites_menaces", "swot",
            "niveau_concurrence", "potentiel_commercial",
        })
        self.assertEqual(data["marche_cible"]["secteur"]["nom"], "FinTech")
        self.assertEqual(data["hypotheses"], "Les PME paient une commission")
        self.assertEqual(data["offre"]["prix_propose"], 16.0)
        self.assertEqual(len(data["concurrents"]), 4)
        self.assertEqual([c["nom"] for c in data["concurrents"]], ["A", "B", "C", "D"])
        self.assertEqual(data["personas"][0]["revenu_estime"], 2500.0)
        self.assertEqual(data["niveau_concurrence"], "eleve")
        # Croissance +2, concurrence élevée -1, prix économique +1, tendances 0, persona +1
        self.assertEqual(data["potentiel_commercial"]["score"], 3)
        self.assertEqual(data["potentiel_commercial"]["niveau"], "moyen")
        # Aucune SWOT enregistrée : calculée à la volée par SWOT-SERVICE (aperçu)
        self.assertEqual(data["swot"]["source"], "calculee")
        self.assertTrue(data["swot"]["opportunites"])
        self.mocks["swot_apercu"].assert_called_once()

    def test_rapport_reprend_la_swot_enregistree(self):
        self.distant.swot.append({"id": 1, "etude": self.etude.id, "etude_id": self.etude.id, "type": "force",
                                  "description": "Manuel", "genere_automatiquement": False})
        data = self.client.get(self.url("rapport")).json()
        self.assertEqual(data["swot"]["source"], "enregistree")
        self.assertEqual([e["description"] for e in data["swot"]["forces"]], ["Manuel"])
        self.mocks["swot_apercu"].assert_not_called()

    def test_potentiel_fort_et_faible(self):
        # Marché peu concurrentiel, en croissance, prix aligné, personas : fort
        self.etude.concurrent_ids = self.concurrents[2:]
        self.etude.tendance_ids = [self.positive]
        self.etude.prix_propose = Decimal("20")
        self.etude.save()
        Persona.objects.create(etude=self.etude, nom="Sami")
        self.assertEqual(self.client.get(self.url("rapport")).json()
                         ["potentiel_commercial"]["niveau"], "fort")

        # Marché en recul, concurrence élevée, prix premium, sans persona : faible
        etude = EtudeMarche.objects.create(projet_id=3, secteur_id=self.secteur, titre="Risquée",
                                           taux_croissance=Decimal("-5"), prix_propose=Decimal("99"),
                                           concurrent_ids=self.concurrents, tendance_ids=[self.negative])
        data = self.client.get(self.url("rapport", etude)).json()
        self.assertEqual(data["potentiel_commercial"]["niveau"], "faible")
        # Somme des points = -3 : le score affiché est borné à 0, le détail reste visible
        self.assertEqual(data["potentiel_commercial"]["score"], 0)
        self.assertEqual(data["potentiel_commercial"]["conclusion"], "Potentiel commercial faible (score 0/7).")
        self.assertIn("Marché en recul (5 %/an) : -1", data["potentiel_commercial"]["justification"])
        self.assertIn("Niveau de concurrence élevé : -1", data["potentiel_commercial"]["justification"])

    def test_potentiel_concurrence_elevee_sans_croissance_zero_sur_7(self):
        # Concurrence élevée (-1), croissance nulle (0), aucun autre point : 0/7, pas -1/7
        etude = EtudeMarche.objects.create(projet_id=3, secteur_id=self.secteur, titre="Saturée",
                                           taux_croissance=Decimal("0"), concurrent_ids=self.concurrents)
        p = self.client.get(self.url("rapport", etude)).json()["potentiel_commercial"]
        self.assertEqual((p["score"], p["score_max"], p["niveau"]), (0, 7, "faible"))
        self.assertEqual(p["justification"], ["Niveau de concurrence élevé : -1"])

    def test_textes_au_format_francais(self):
        om = self.client.get(self.url("opportunites-menaces")).json()
        textes = [e["description"] for e in om["opportunites"] + om["menaces"]]
        self.assertIn("Marché en forte croissance (+12,5 % par an).", textes)
        self.assertIn("Prix inférieur de 20 % à la moyenne des concurrents : "
                      "argument fort pour attirer les clients.", textes)
        justification = self.client.get(self.url("rapport")).json()["potentiel_commercial"]["justification"]
        self.assertIn("Forte croissance du marché (+12,5 %/an) : +2", justification)
        # Les nombres bruts du JSON restent des nombres
        self.assertEqual(om["taux_croissance"], 12.5)

    def test_rapport_pdf_nombres_au_format_francais(self):
        self.etude.taille_marche = Decimal("2000000")
        self.etude.prix_propose = Decimal("25")
        self.etude.save()
        Persona.objects.create(etude=self.etude, nom="Sami", revenu_estime=Decimal("400"))
        textes = []
        from etudes.services import rapport_pdf
        vrai = rapport_pdf.Paragraph
        with mock.patch.object(rapport_pdf, "Paragraph",
                               side_effect=lambda texte, *a, **k: textes.append(str(texte)) or vrai(texte, *a, **k)):
            response = self.client.get(self.url("rapport-pdf"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        S = " "
        for attendu in (f"2{S}000{S}000{S}€", f"12,5{S}%", f"25{S}€", f"400{S}€ / mois",
                        f"20{S}€", f"+25{S}%", f"30{S}%"):  # prix moyen 20 €, écart +25 %, part 30 %
            self.assertIn(attendu, textes, attendu)
        self.assertFalse([t for t in textes if ".00" in t], "aucun « .00 » dans le PDF")

    def test_rapport_etude_vide(self):
        etude = EtudeMarche.objects.create(projet_id=3, secteur_id=self.secteur, titre="Vide")
        response = self.client.get(self.url("rapport", etude))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["niveau_concurrence"], "inconnu")

    def test_rapport_pdf(self):
        Persona.objects.create(etude=self.etude, nom="Sami <script>", besoins="Ligne 1\nLigne 2")
        response = self.client.get(self.url("rapport-pdf"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn(f"etude-marche-{self.etude.id}.pdf", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_rapport_pdf_etude_vide(self):
        etude = EtudeMarche.objects.create(projet_id=3, secteur_id=self.secteur, titre="Vide")
        response = self.client.get(self.url("rapport-pdf", etude))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_rapport_etude_inexistante(self):
        response = self.client.get(reverse("etude-rapport", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_rapport_swot_service_indisponible(self):
        self.mocks["swot_de_l_etude"].side_effect = ServiceIndisponible("SWOT-SERVICE")
        response = self.client.get(self.url("rapport"))
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.json(), {"service": "SWOT-SERVICE", "message": "Service indisponible"})


class SeedEtudesTests(APITestCase):
    def test_seed_etudes_idempotent(self):
        concurrents = ["Flouci", "Konnect", "Paymee", "Stripe", "GoMyCode", "OpenClassrooms", "Coursera"]
        tendances = ["Adoption massive du paiement mobile", "Renforcement de la réglementation BCT",
                     "Open banking", "Apprentissage hybride", "Baisse du pouvoir d'achat des ménages"]
        ids = {
            "secteurs": {"FinTech": 1, "EdTech": 2, "HealthTech": 3},
            "concurrents": {nom: 10 + i for i, nom in enumerate(concurrents)},
            "tendances": {titre: 20 + i for i, titre in enumerate(tendances)},
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(ids, f, ensure_ascii=False)
        call_command("seed_etudes", ids=f.name, stdout=StringIO())
        call_command("seed_etudes", ids=f.name, stdout=StringIO())
        self.assertEqual(EtudeMarche.objects.count(), 4)
        self.assertEqual(sorted(set(EtudeMarche.objects.values_list("projet_id", flat=True))), [1, 2, 3])
        completes = EtudeMarche.objects.filter(entrepreneur_id__isnull=False)
        self.assertEqual(completes.count(), 2)
        self.assertEqual(Persona.objects.count(), 3)
        fintech = completes.get(projet_id=1)
        self.assertEqual(fintech.statut, "finalisee")
        self.assertEqual(fintech.secteur_id, 1)
        self.assertEqual(fintech.concurrent_ids, [10, 11, 12, 13])
        self.assertEqual(fintech.tendance_ids, [20, 21, 22])
