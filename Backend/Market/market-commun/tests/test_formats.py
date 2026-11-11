"""Tests du formatage français des nombres (market_commun.formats)."""

from decimal import Decimal

from django.test import SimpleTestCase

from market_commun.formats import montant, nombre, pourcentage

S = " "  # espace insécable


class FormatsTests(SimpleTestCase):
    def test_montant(self):
        self.assertEqual(montant(2000000), f"2{S}000{S}000{S}€")
        self.assertEqual(montant(Decimal("2000000.00")), f"2{S}000{S}000{S}€")
        self.assertEqual(montant(25.0), f"25{S}€")
        self.assertEqual(montant(Decimal("25.5")), f"25,50{S}€")
        self.assertEqual(montant(1234.567), f"1{S}234,57{S}€")
        self.assertEqual(montant(400, par="mois"), f"400{S}€ / mois")
        self.assertEqual(montant(None), "—")

    def test_pourcentage(self):
        self.assertEqual(pourcentage(Decimal("12.00")), f"12{S}%")
        self.assertEqual(pourcentage(Decimal("65.28")), f"65,28{S}%")
        self.assertEqual(pourcentage(12.5), f"12,5{S}%")
        self.assertEqual(pourcentage(-33.333), f"-33,33{S}%")
        self.assertEqual(pourcentage(12, signe=True), f"+12{S}%")
        self.assertEqual(pourcentage(0, signe=True), f"0{S}%")
        self.assertEqual(pourcentage(None), "—")

    def test_nombre(self):
        self.assertEqual(nombre(1234567.891), f"1{S}234{S}567,89")
        self.assertEqual(nombre(0), "0")
        self.assertEqual(nombre(-1500), f"-1{S}500")
