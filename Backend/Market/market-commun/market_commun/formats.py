"""
Nombres au format français pour les TEXTES destinés à l'utilisateur (rapport PDF, SWOT générée,
opportunités / menaces, justification du potentiel commercial).

Les nombres bruts de l'API JSON restent des nombres : ces fonctions ne servent qu'à rédiger.

    montant(2000000)        -> "2 000 000 €"
    montant(25.5)           -> "25,50 €"
    pourcentage(12)         -> "12 %"
    pourcentage(65.28)      -> "65,28 %"
    pourcentage(12.5, signe=True) -> "+12,5 %"
    montant(400, par="mois") -> "400 € / mois"

Séparateur des milliers et espace avant l'unité : espace insécable (pas de retour à la ligne
au milieu d'un nombre).
"""

from decimal import ROUND_HALF_UP, Decimal

ESPACE = " "  # espace insécable
DEVISE = "€"
VIDE = "—"


def _decimal(valeur):
    return valeur if isinstance(valeur, Decimal) else Decimal(str(valeur))


def nombre(valeur, decimales=2, zeros_inutiles=True):
    """
    Nombre français : milliers séparés par une espace, virgule décimale, `decimales` chiffres
    au plus (arrondi au plus proche). zeros_inutiles=True : 12.50 -> "12,5", 12.00 -> "12".
    """
    d = _decimal(valeur).quantize(Decimal(1).scaleb(-decimales), rounding=ROUND_HALF_UP)
    signe = "-" if d < 0 else ""
    entier, _, fraction = f"{abs(d):f}".partition(".")
    if zeros_inutiles:
        fraction = fraction.rstrip("0")
    entier = f"{int(entier):,}".replace(",", ESPACE)
    return signe + entier + ("," + fraction if fraction else "")


def pourcentage(valeur, signe=False):
    """12 -> "12 %", 65.28 -> "65,28 %" ; signe=True : "+12 %" pour une valeur positive."""
    if valeur is None:
        return VIDE
    texte = nombre(valeur)
    if signe and _decimal(valeur) > 0:
        texte = "+" + texte
    return f"{texte}{ESPACE}%"


def montant(valeur, devise=DEVISE, par=None):
    """
    2000000 -> "2 000 000 €" ; 25.5 -> "25,50 €" (centimes affichés seulement s'il y en a) ;
    par="mois" -> "400 € / mois".
    """
    if valeur is None:
        return VIDE
    d = _decimal(valeur)
    entier = d == d.to_integral_value()
    texte = nombre(d, decimales=0 if entier else 2, zeros_inutiles=False)
    texte = f"{texte}{ESPACE}{devise}"
    return f"{texte} / {par}" if par else texte
