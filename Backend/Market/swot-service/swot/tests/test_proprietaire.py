"""
SWOT des seules études de l'utilisateur connecté (jeton transmis par la gateway) :
les ids de ses études sont lus sur ETUDE-SERVICE (?entrepreneur_id=<sub>, appel interne).
ADMIN et appels internes sans jeton : toutes les études.
"""

from unittest import mock

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from market_commun.testing import connecte
from swot.models import ElementSWOT

from .test_api import AUTRE_ETUDE, ETUDE, EtudeServiceMockeMixin

A = connecte("sub-aziz", "aziz")            # propriétaire de ETUDE
B = connecte("sub-bouthaina", "bouthaina")  # propriétaire de AUTRE_ETUDE
ADMIN = connecte("sub-ahmed", "ahmed", roles=["ADMIN"])
PROPRIETAIRES = {"sub-aziz": [ETUDE], "sub-bouthaina": [AUTRE_ETUDE]}


class SwotProprietaireTests(EtudeServiceMockeMixin, APITestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch(
            "clients.etude_client.EtudeClient.list", autospec=True,
            side_effect=lambda client, ids=None, entrepreneur_id=None, **f: [
                {"id": i} for i in PROPRIETAIRES.get(entrepreneur_id, [])],
        )
        self.list = patcher.start()
        self.addCleanup(patcher.stop)
        self.element_a = ElementSWOT.objects.create(etude_id=ETUDE, type="force", description="Force d'Aziz")
        self.element_b = ElementSWOT.objects.create(etude_id=AUTRE_ETUDE, type="menace", description="Menace de B")

    def descriptions(self, **entetes):
        return sorted(e["description"] for e in self.client.get(reverse("swot-list"), **entetes).json())

    def test_liste_limitee_aux_etudes_de_l_utilisateur(self):
        self.assertEqual(self.descriptions(**A), ["Force d'Aziz"])
        self.assertEqual(self.descriptions(**B), ["Menace de B"])
        self.list.assert_called_with(mock.ANY, entrepreneur_id="sub-bouthaina")
        # Filtre ?etude= sur l'étude d'un autre : liste vide
        response = self.client.get(reverse("swot-list"), {"etude": ETUDE}, **B)
        self.assertEqual(response.json(), [])

    def test_admin_et_appel_interne_voient_tout(self):
        self.assertEqual(self.descriptions(**ADMIN), ["Force d'Aziz", "Menace de B"])
        self.assertEqual(self.descriptions(), ["Force d'Aziz", "Menace de B"])
        self.list.assert_not_called()  # aucune restriction : pas d'appel à ETUDE-SERVICE

    def test_element_d_un_autre_404(self):
        url = reverse("swot-detail", args=[self.element_a.id])
        self.assertEqual(self.client.get(url, **B).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(url, {"description": "X"}, format="json", **B).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(url, **B).status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ElementSWOT.objects.filter(pk=self.element_a.pk, description="Force d'Aziz").exists())
        self.assertEqual(self.client.get(url, **A).status_code, status.HTTP_200_OK)

    def test_creation_sur_l_etude_d_un_autre_refusee(self):
        response = self.client.post(reverse("swot-list"), {"etude": ETUDE, "type": "force", "description": "Intrus"},
                                    format="json", **B)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json(), {"etude_id": ["Étude introuvable"]})  # comme une étude inexistante
        response = self.client.post(reverse("swot-list"), {"etude": ETUDE, "type": "force", "description": "OK"},
                                    format="json", **A)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_generer_et_supprimer_la_swot_d_un_autre_404(self):
        self.assertEqual(self.client.post(reverse("etude-generer-swot", args=[ETUDE]), **B).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.get(reverse("etude-generer-swot", args=[ETUDE]), **B).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(reverse("swot-par-etude", args=[ETUDE]), **B).status_code,
                         status.HTTP_404_NOT_FOUND)
        self.assertTrue(ElementSWOT.objects.filter(etude_id=ETUDE).exists())
        self.assertEqual(self.client.post(reverse("etude-generer-swot", args=[ETUDE]), **A).status_code,
                         status.HTTP_200_OK)
