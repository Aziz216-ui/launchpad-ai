"""Tests de market_commun.identite (utilisateur lu dans le jeton transmis par la gateway)."""

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from market_commun.identite import JetonInvalide, proprietaire_a_filtrer, utilisateur_de
from market_commun.testing import jeton

requete = APIRequestFactory().get


class IdentiteTests(SimpleTestCase):
    def test_sans_jeton_appel_interne(self):
        self.assertIsNone(utilisateur_de(requete("/")))
        self.assertIsNone(proprietaire_a_filtrer(requete("/")))

    def test_claims_lus(self):
        r = requete("/", HTTP_AUTHORIZATION=f"Bearer {jeton('sub-a', 'aziz', ['ENTREPRENEUR', 'x'])}")
        u = utilisateur_de(r)
        self.assertEqual((u.id, u.username, u.roles), ("sub-a", "aziz", frozenset({"ENTREPRENEUR", "x"})))
        self.assertFalse(u.est_admin)
        self.assertEqual(proprietaire_a_filtrer(r), u)

    def test_admin_non_filtre(self):
        r = requete("/", HTTP_AUTHORIZATION=f"Bearer {jeton('sub-z', 'ahmed', ['ADMIN'])}")
        self.assertTrue(utilisateur_de(r).est_admin)
        self.assertIsNone(proprietaire_a_filtrer(r))

    def test_jeton_illisible_401(self):
        for entete in ("Bearer abc", "Bearer a.!!!.c", "Basic dXNlcjpwdw==", "Bearer "):
            with self.subTest(entete=entete), self.assertRaises(JetonInvalide):
                utilisateur_de(requete("/", HTTP_AUTHORIZATION=entete))

    def test_jeton_sans_sub_401(self):
        with self.assertRaises(JetonInvalide):
            utilisateur_de(requete("/", HTTP_AUTHORIZATION=f"Bearer {jeton('', 'x')}"))
