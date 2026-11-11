"""Tests de la règle commune du niveau de concurrence (market_commun.concurrence)."""

from decimal import Decimal

from django.test import SimpleTestCase

from market_commun.concurrence import (
    calculer_niveau_concurrence, niveau_des_concurrents, niveau_le_plus_eleve, part_cumulee, prix_moyen,
)


def concurrent(prix="0", part="0"):
    return {"prix_moyen": float(prix), "part_de_marche": float(part)}


class NiveauConcurrenceTests(SimpleTestCase):
    def test_seuils(self):
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("10")), "faible")
        self.assertEqual(calculer_niveau_concurrence(3, Decimal("10")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(1, Decimal("30")), "moyen")
        self.assertEqual(calculer_niveau_concurrence(6, Decimal("0")), "eleve")
        self.assertEqual(calculer_niveau_concurrence(2, Decimal("60")), "eleve")

    def test_aucun_concurrent_inconnu(self):
        # Rien à évaluer : "inconnu" et non "faible"
        self.assertEqual(calculer_niveau_concurrence(0, Decimal("0")), "inconnu")
        self.assertEqual(niveau_des_concurrents([]), "inconnu")

    def test_niveau_des_concurrents(self):
        self.assertEqual(niveau_des_concurrents([concurrent(part="20"), concurrent(part="15")]), "moyen")
        self.assertEqual(part_cumulee([concurrent(part="20.5"), concurrent(part="15")]), Decimal("35.50"))

    def test_niveau_le_plus_eleve(self):
        self.assertEqual(niveau_le_plus_eleve(["faible", "eleve", "moyen"]), "eleve")
        self.assertEqual(niveau_le_plus_eleve(["inconnu", "faible"]), "faible")
        self.assertEqual(niveau_le_plus_eleve([]), "inconnu")


class PrixMoyenTests(SimpleTestCase):
    def test_prix_moyen(self):
        self.assertEqual(prix_moyen([concurrent(prix="10"), concurrent(prix="20")]), Decimal("15"))

    def test_aucun_concurrent_none(self):
        # null et non 0.0 : il n'y a pas de prix de marché
        self.assertIsNone(prix_moyen([]))
