"""
Études liées à l'utilisateur connecté (jeton Keycloak transmis par la gateway) :
un entrepreneur ne voit et ne modifie que ses études, l'ADMIN voit tout, et les appels
internes sans jeton (AI-Service, consumers, autres services) gardent l'accès complet.
"""

from unittest import mock

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from etudes.models import EtudeMarche, Persona
from market_commun.testing import connecte

from .faux_services import FauxServices

A = connecte("sub-aziz", "aziz")
B = connecte("sub-bouthaina", "bouthaina")
ADMIN = connecte("sub-ahmed", "ahmed", roles=["ADMIN", "default-roles-launchpad"])


class ProprietaireTests(APITestCase):
    def setUp(self):
        self.distant = FauxServices()
        self.mocks = self.distant.demarrer(self)
        self.secteur = self.distant.secteur("FinTech")
        self.etude_a = EtudeMarche.objects.create(projet_id=1, entrepreneur_id="sub-aziz",
                                                  secteur_id=self.secteur, titre="Étude d'Aziz")
        self.etude_b = EtudeMarche.objects.create(projet_id=1, entrepreneur_id="sub-bouthaina",
                                                  secteur_id=self.secteur, titre="Étude de Bouthaina")
        self.persona_a = Persona.objects.create(etude=self.etude_a, nom="Persona d'Aziz")

    def titres(self, **entetes):
        return sorted(e["titre"] for e in self.client.get(reverse("etude-list"), **entetes).json())

    def detail(self, nom, etude, **kwargs):
        return reverse(f"etude-{nom}", args=[etude.id])

    # --- Création ---------------------------------------------------------------

    def test_creation_entrepreneur_id_du_jeton(self):
        # La valeur envoyée par le client est ignorée : le propriétaire est l'utilisateur du jeton
        response = self.client.post(reverse("etude-list"), {
            "projet_id": 1, "secteur": self.secteur, "titre": "Nouvelle", "entrepreneur_id": "sub-bouthaina",
        }, format="json", **A)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["entrepreneur_id"], "sub-aziz")
        self.assertEqual(EtudeMarche.objects.get(titre="Nouvelle").entrepreneur_id, "sub-aziz")

    # --- Liste ------------------------------------------------------------------

    def test_entrepreneur_ne_voit_que_ses_etudes(self):
        self.assertEqual(self.titres(**A), ["Étude d'Aziz"])
        self.assertEqual(self.titres(**B), ["Étude de Bouthaina"])

    def test_filtre_entrepreneur_id_ne_contourne_pas(self):
        response = self.client.get(reverse("etude-list"), {"entrepreneur_id": "sub-bouthaina"}, **A)
        self.assertEqual(response.json(), [])

    def test_admin_voit_tout(self):
        self.assertEqual(self.titres(**ADMIN), ["Étude d'Aziz", "Étude de Bouthaina"])

    def test_sans_jeton_appel_interne_voit_tout(self):
        self.assertEqual(self.titres(), ["Étude d'Aziz", "Étude de Bouthaina"])

    # --- Actions sur l'étude d'un autre : 404 -------------------------------------

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_etude_d_un_autre_404(self, envoyer):
        url = self.detail("detail", self.etude_a)
        appels = {
            "GET": lambda: self.client.get(url, **B),
            "PATCH": lambda: self.client.patch(url, {"titre": "Piraté"}, format="json", **B),
            "PUT": lambda: self.client.put(url, {"projet_id": 1, "secteur": self.secteur, "titre": "Piraté"},
                                           format="json", **B),
            "finaliser": lambda: self.client.post(self.detail("finaliser", self.etude_a), **B),
            "comparaison-prix": lambda: self.client.get(self.detail("comparaison-prix", self.etude_a), **B),
            "opportunites-menaces": lambda: self.client.get(self.detail("opportunites-menaces", self.etude_a), **B),
            "rapport": lambda: self.client.get(self.detail("rapport", self.etude_a), **B),
            "DELETE": lambda: self.client.delete(url, **B),
        }
        for nom, appel in appels.items():
            with self.subTest(nom):
                self.assertEqual(appel().status_code, status.HTTP_404_NOT_FOUND)
        self.etude_a.refresh_from_db()
        self.assertEqual((self.etude_a.titre, self.etude_a.statut), ("Étude d'Aziz", "brouillon"))
        envoyer.assert_not_called()  # ni etude.finalisee ni etude.supprimee

    def test_proprietaire_et_admin_accedent(self):
        url = self.detail("detail", self.etude_a)
        self.assertEqual(self.client.get(url, **A).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(url, **ADMIN).status_code, status.HTTP_200_OK)
        response = self.client.patch(url, {"cible": "PME"}, format="json", **A)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @mock.patch("market_commun.evenements.producteur.envoyer")
    def test_admin_supprime_l_etude_d_un_entrepreneur(self, envoyer):
        response = self.client.delete(self.detail("detail", self.etude_a), **ADMIN)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    # --- Personas ---------------------------------------------------------------

    def test_personas_d_un_autre_invisibles(self):
        self.assertEqual(self.client.get(reverse("persona-list"), **B).json(), [])
        url = reverse("persona-detail", args=[self.persona_a.id])
        self.assertEqual(self.client.get(url, **B).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(url, {"nom": "X"}, format="json", **B).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(url, **B).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual([p["nom"] for p in self.client.get(reverse("persona-list"), **A).json()],
                         ["Persona d'Aziz"])
        self.assertEqual(len(self.client.get(reverse("persona-list"), **ADMIN).json()), 1)

    def test_persona_sur_l_etude_d_un_autre_refuse(self):
        response = self.client.post(reverse("persona-list"), {"etude": self.etude_a.id, "nom": "Intrus"},
                                    format="json", **B)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("etude", response.json())
        self.assertFalse(Persona.objects.filter(nom="Intrus").exists())
        response = self.client.post(reverse("persona-list"), {"etude": self.etude_a.id, "nom": "Sami"},
                                    format="json", **A)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # --- Contrat de l'AI-Service inchangé, jeton invalide ---------------------------

    def test_analyse_projet_inchangee(self):
        # Appelée en service à service : même résultat avec ou sans jeton
        sans = self.client.get(reverse("analyse-projet", args=[1])).json()
        avec = self.client.get(reverse("analyse-projet", args=[1]), **B).json()
        self.assertEqual(sans, avec)
        self.assertEqual(sans["nombre_etudes"], 2)

    def test_jeton_illisible_401(self):
        response = self.client.get(reverse("etude-list"), HTTP_AUTHORIZATION="Bearer pas-un-jwt")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
