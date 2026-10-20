"""Tests de la gestion de l'étude de marché (personas, SWOT, prix, rapport)."""

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Concurrent, ElementSWOT, EtudeMarche, Persona, Secteur, Tendance


class EtudeBaseTestCase(APITestCase):
    """Une étude FinTech avec 4 concurrents (prix moyen 20, part cumulée 65 %) et 3 tendances."""

    def setUp(self):
        self.secteur = Secteur.objects.create(nom="FinTech")
        self.concurrents = [
            Concurrent.objects.create(nom=nom, secteur=self.secteur,
                                      prix_moyen=Decimal(prix), part_de_marche=Decimal(part))
            for nom, prix, part in [("A", "10", "30"), ("B", "30", "20"),
                                    ("C", "20", "10"), ("D", "20", "5")]
        ]
        self.positive = Tendance.objects.create(titre="Mobile", secteur=self.secteur,
                                                impact="positif", description="En hausse")
        self.negative = Tendance.objects.create(titre="Régulation", secteur=self.secteur,
                                                impact="negatif")
        self.neutre = Tendance.objects.create(titre="Open banking", secteur=self.secteur,
                                              impact="neutre")
        self.etude = EtudeMarche.objects.create(
            projet_id=1, entrepreneur_id=10, secteur=self.secteur, titre="Paiement PME",
            taux_croissance=Decimal("12.5"), prix_propose=Decimal("16"),
            description_offre="QR code", hypotheses="Les PME paient une commission",
        )
        self.etude.concurrents.set(self.concurrents)
        self.etude.tendances.set([self.positive, self.negative, self.neutre])

    def url(self, nom, etude=None):
        return reverse(f"etude-{nom}", args=[(etude or self.etude).id])


class EtudeCrudTests(EtudeBaseTestCase):
    def test_creer_avec_concurrents_et_tendances(self):
        data = {
            "projet_id": 5, "entrepreneur_id": 42, "secteur": self.secteur.id,
            "titre": "Nouvelle étude", "cible": "PME", "zone_geographique": "Tunisie",
            "hypotheses": "H1", "description_offre": "Offre", "prix_propose": "12.50",
            "concurrents": [self.concurrents[0].id, self.concurrents[1].id],
            "tendances": [self.positive.id],
        }
        response = self.client.post(reverse("etude-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["statut"], "brouillon")
        self.assertEqual(sorted(response.data["concurrents"]),
                         sorted([self.concurrents[0].id, self.concurrents[1].id]))
        etude = EtudeMarche.objects.get(id=response.data["id"])
        self.assertEqual(etude.tendances.count(), 1)
        self.assertEqual(etude.entrepreneur_id, 42)

    def test_creer_sans_nouveaux_champs(self):
        # Compatibilité : le format de création d'origine reste valide
        data = {"projet_id": 1, "secteur": self.secteur.id, "titre": "Ancien format"}
        response = self.client.post(reverse("etude-list"), data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["entrepreneur_id"])
        self.assertEqual(response.data["concurrents"], [])

    def test_statut_non_modifiable_directement(self):
        response = self.client.patch(self.url("detail"), {"statut": "finalisee"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.statut, "brouillon")

    def test_modifier_criteres_marche_et_hypotheses(self):
        response = self.client.patch(self.url("detail"), {
            "cible": "Commerçants", "zone_geographique": "Sfax", "hypotheses": "H2",
            "concurrents": [self.concurrents[2].id],
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.cible, "Commerçants")
        self.assertEqual(self.etude.hypotheses, "H2")
        self.assertEqual(list(self.etude.concurrents.all()), [self.concurrents[2]])

    def test_detail_inclut_elements_lies(self):
        Persona.objects.create(etude=self.etude, nom="Sami")
        ElementSWOT.objects.create(etude=self.etude, type="force", description="Équipe")
        data = self.client.get(self.url("detail")).json()
        self.assertEqual([p["nom"] for p in data["personas"]], ["Sami"])
        self.assertEqual([s["description"] for s in data["swot"]], ["Équipe"])
        self.assertEqual(len(data["concurrents_details"]), 4)
        self.assertEqual(data["concurrents_details"][0]["secteur_nom"], "FinTech")
        self.assertEqual(len(data["tendances_details"]), 3)

    def test_concurrent_inexistant(self):
        response = self.client.patch(self.url("detail"), {"concurrents": [9999]}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("concurrents", response.data)

    def test_prix_propose_negatif(self):
        response = self.client.patch(self.url("detail"), {"prix_propose": "-1"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("prix_propose", response.data)

    def test_filtres_entrepreneur_et_statut(self):
        EtudeMarche.objects.create(projet_id=2, entrepreneur_id=11, secteur=self.secteur,
                                   titre="Autre", statut="finalisee")
        liste = reverse("etude-list")
        self.assertEqual([e["titre"] for e in self.client.get(liste, {"entrepreneur_id": 10}).data],
                         ["Paiement PME"])
        self.assertEqual([e["titre"] for e in self.client.get(liste, {"statut": "finalisee"}).data],
                         ["Autre"])

    def test_supprimer_brouillon_supprime_personas_et_swot(self):
        Persona.objects.create(etude=self.etude, nom="Sami")
        ElementSWOT.objects.create(etude=self.etude, type="force", description="X")
        response = self.client.delete(self.url("detail"))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Persona.objects.count(), 0)
        self.assertEqual(ElementSWOT.objects.count(), 0)
        # Les concurrents et tendances partagés ne sont pas supprimés
        self.assertEqual(Concurrent.objects.count(), 4)

    def test_finaliser(self):
        response = self.client.post(self.url("finaliser"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], "finalisee")
        self.etude.refresh_from_db()
        self.assertEqual(self.etude.statut, "finalisee")
        # Idempotent
        self.assertEqual(self.client.post(self.url("finaliser")).status_code, status.HTTP_200_OK)

    def test_finaliser_etude_inexistante(self):
        response = self.client.post(reverse("etude-finaliser", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


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

        detail = reverse("persona-detail", args=[pk])
        self.assertEqual(self.client.get(detail).data["nom"], "Sami")
        response = self.client.patch(detail, {"profession": "Grossiste"}, format="json")
        self.assertEqual(response.data["profession"], "Grossiste")
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Persona.objects.exists())

    def test_filtre_etude(self):
        autre = EtudeMarche.objects.create(projet_id=2, secteur=self.secteur, titre="Autre")
        Persona.objects.create(etude=self.etude, nom="P1")
        Persona.objects.create(etude=autre, nom="P2")
        response = self.client.get(reverse("persona-list"), {"etude": autre.id})
        self.assertEqual([p["nom"] for p in response.data], ["P2"])

    def test_revenu_negatif_invalide(self):
        response = self.client.post(reverse("persona-list"), {
            "etude": self.etude.id, "nom": "X", "revenu_estime": "-10",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("revenu_estime", response.data)


class SwotCrudTests(EtudeBaseTestCase):
    def test_crud(self):
        liste = reverse("swot-list")
        response = self.client.post(liste, {
            "etude": self.etude.id, "type": "force", "description": "Équipe expérimentée",
            "genere_automatiquement": True,  # ignoré : une saisie API est manuelle
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["genere_automatiquement"])

        detail = reverse("swot-detail", args=[response.data["id"]])
        response = self.client.patch(detail, {"type": "opportunite"}, format="json")
        self.assertEqual(response.data["type"], "opportunite")
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_204_NO_CONTENT)

    def test_type_invalide(self):
        response = self.client.post(reverse("swot-list"), {
            "etude": self.etude.id, "type": "autre", "description": "X",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("type", response.data)

    def test_filtres_etude_et_type(self):
        autre = EtudeMarche.objects.create(projet_id=2, secteur=self.secteur, titre="Autre")
        ElementSWOT.objects.create(etude=self.etude, type="force", description="F1")
        ElementSWOT.objects.create(etude=self.etude, type="menace", description="M1")
        ElementSWOT.objects.create(etude=autre, type="force", description="F2")
        response = self.client.get(reverse("swot-list"), {"etude": self.etude.id, "type": "force"})
        self.assertEqual([e["description"] for e in response.data], ["F1"])


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

        self.etude.concurrents.clear()
        data = self.client.get(self.url("comparaison-prix")).json()
        self.assertEqual(data["nombre_concurrents"], 0)
        self.assertIsNone(data["prix_moyen"])
        self.assertEqual(data["concurrents"], [])


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
        self.etude.save()
        self.etude.concurrents.set(self.concurrents[2:])  # 2 concurrents, 15 % -> faible
        data = self.client.get(self.url("opportunites-menaces")).json()
        self.assertEqual(data["niveau_concurrence"], "faible")
        self.assertIn("concurrence", [e["source"] for e in data["opportunites"]])
        self.assertEqual(sorted(e["source"] for e in data["menaces"]),
                         ["croissance", "prix", "tendance"])


class GenererSwotTests(EtudeBaseTestCase):
    def test_generation_conserve_les_elements_manuels(self):
        manuel = ElementSWOT.objects.create(etude=self.etude, type="force",
                                            description="Équipe expérimentée")
        response = self.client.post(self.url("generer-swot"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conserves"], 1)
        generes = response.data["generes"]
        self.assertGreater(generes, 0)

        descriptions = {(e["type"], e["description"]) for e in response.data["swot"]}
        self.assertIn(("force", "Équipe expérimentée"), descriptions)
        # Règles : prix sous la moyenne -> force ; concurrence élevée -> menace ;
        # croissance > 10 % -> opportunité ; aucun persona -> faiblesse
        types = [e["type"] for e in response.data["swot"] if e["genere_automatiquement"]]
        self.assertIn("force", types)
        self.assertIn("menace", types)
        self.assertIn("opportunite", types)
        self.assertIn(("faiblesse", "Cible clients non définie : aucun persona."), descriptions)

        # Une 2e génération remplace les éléments automatiques sans doublon
        self.client.post(self.url("generer-swot"))
        self.assertEqual(self.etude.swot.filter(genere_automatiquement=True).count(), generes)
        self.assertTrue(ElementSWOT.objects.filter(id=manuel.id).exists())

    def test_generation_suit_les_donnees(self):
        self.client.post(self.url("generer-swot"))
        Persona.objects.create(etude=self.etude, nom="Sami")
        self.client.post(self.url("generer-swot"))
        descriptions = list(self.etude.swot.values_list("description", flat=True))
        self.assertNotIn("Cible clients non définie : aucun persona.", descriptions)
        self.assertIn("Cible clients définie (1 persona(s)).", descriptions)


class RapportTests(EtudeBaseTestCase):
    def test_rapport_json(self):
        Persona.objects.create(etude=self.etude, nom="Sami", revenu_estime=Decimal("2500"))
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
        self.assertEqual(data["personas"][0]["revenu_estime"], 2500.0)
        self.assertEqual(data["niveau_concurrence"], "eleve")
        # Croissance +2, concurrence élevée -1, prix économique +1, tendances 0, persona +1
        self.assertEqual(data["potentiel_commercial"]["score"], 3)
        self.assertEqual(data["potentiel_commercial"]["niveau"], "moyen")
        # Aucune SWOT enregistrée : calculée à la volée, sans écriture en base
        self.assertEqual(data["swot"]["source"], "calculee")
        self.assertTrue(data["swot"]["opportunites"])
        self.assertFalse(ElementSWOT.objects.exists())

    def test_rapport_reprend_la_swot_enregistree(self):
        ElementSWOT.objects.create(etude=self.etude, type="force", description="Manuel")
        data = self.client.get(self.url("rapport")).json()
        self.assertEqual(data["swot"]["source"], "enregistree")
        self.assertEqual([e["description"] for e in data["swot"]["forces"]], ["Manuel"])

    def test_potentiel_fort_et_faible(self):
        # Marché peu concurrentiel, en croissance, prix aligné, personas : fort
        self.etude.concurrents.set(self.concurrents[2:])
        self.etude.tendances.set([self.positive])
        self.etude.prix_propose = Decimal("20")
        self.etude.save()
        Persona.objects.create(etude=self.etude, nom="Sami")
        self.assertEqual(self.client.get(self.url("rapport")).json()
                         ["potentiel_commercial"]["niveau"], "fort")

        # Marché en recul, concurrence élevée, prix premium, sans persona : faible
        etude = EtudeMarche.objects.create(projet_id=3, secteur=self.secteur, titre="Risquée",
                                           taux_croissance=Decimal("-5"), prix_propose=Decimal("99"))
        etude.concurrents.set(self.concurrents)
        etude.tendances.set([self.negative])
        data = self.client.get(self.url("rapport", etude)).json()
        self.assertEqual(data["potentiel_commercial"]["niveau"], "faible")

    def test_rapport_etude_vide(self):
        etude = EtudeMarche.objects.create(projet_id=3, secteur=self.secteur, titre="Vide")
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
        etude = EtudeMarche.objects.create(projet_id=3, secteur=self.secteur, titre="Vide")
        response = self.client.get(self.url("rapport-pdf", etude))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_rapport_etude_inexistante(self):
        response = self.client.get(reverse("etude-rapport", args=[9999]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SeedEtudesTests(APITestCase):
    def test_seed_etudes_completes_idempotent(self):
        call_command("seed_marche", stdout=StringIO())
        call_command("seed_marche", stdout=StringIO())
        completes = EtudeMarche.objects.filter(entrepreneur_id__isnull=False)
        self.assertEqual(completes.count(), 2)
        self.assertEqual(Persona.objects.count(), 3)
        self.assertEqual(ElementSWOT.objects.filter(genere_automatiquement=False).count(), 1)
        for etude in completes:
            self.assertTrue(etude.concurrents.exists())
            self.assertTrue(etude.tendances.exists())
            self.assertTrue(etude.personas.exists())
            self.assertTrue(etude.swot.filter(genere_automatiquement=True).exists())

        fintech = completes.get(projet_id=1)
        self.assertEqual(fintech.statut, "finalisee")
        rapport = self.client.get(reverse("etude-rapport", args=[fintech.id])).json()
        self.assertEqual(rapport["comparaison_prix"]["positionnement"], "economique")


class SchemaEtudeTests(APITestCase):
    def test_nouveaux_endpoints_documentes(self):
        paths = self.client.get(reverse("schema"), {"format": "json"}).json()["paths"]
        for chemin in [
            "/api/market/personas/", "/api/market/swot/",
            "/api/market/etudes/{id}/finaliser/", "/api/market/etudes/{id}/comparaison-prix/",
            "/api/market/etudes/{id}/opportunites-menaces/", "/api/market/etudes/{id}/generer-swot/",
            "/api/market/etudes/{id}/rapport/", "/api/market/etudes/{id}/rapport/pdf/",
        ]:
            self.assertIn(chemin, paths)
