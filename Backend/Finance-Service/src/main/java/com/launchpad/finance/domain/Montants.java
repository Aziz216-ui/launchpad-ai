package com.launchpad.finance.domain;

import com.launchpad.finance.exception.DonneesInvalides;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Règles communes aux montants : BigDecimal, 2 décimales, arrondi HALF_UP,
 * capacité d'une colonne numeric(15,2).
 */
public final class Montants {

    public static final int ECHELLE = 2;
    public static final RoundingMode ARRONDI = RoundingMode.HALF_UP;
    public static final BigDecimal MAXIMUM = new BigDecimal("9999999999999.99");
    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(ECHELLE);
    private static final BigDecimal CENT = BigDecimal.valueOf(100);

    private Montants() {
    }

    public static BigDecimal arrondir(BigDecimal valeur) {
        return valeur.setScale(ECHELLE, ARRONDI);
    }

    /** Montant obligatoire, arrondi, dans la capacité numeric(15,2) (peut être négatif). */
    public static BigDecimal exiger(BigDecimal valeur, String nom) {
        if (valeur == null) {
            throw new DonneesInvalides(nom + " est obligatoire");
        }
        BigDecimal arrondi = arrondir(valeur);
        if (arrondi.abs().compareTo(MAXIMUM) > 0) {
            throw new DonneesInvalides(nom + " dépasse le montant maximal autorisé (" + MAXIMUM + ")");
        }
        return arrondi;
    }

    public static BigDecimal exigerPositifOuNul(BigDecimal valeur, String nom) {
        BigDecimal montant = exiger(valeur, nom);
        if (montant.signum() < 0) {
            throw new DonneesInvalides(nom + " doit être positif ou nul");
        }
        return montant;
    }

    /** part / total × 100, à 2 décimales ; renvoie 0.00 si total = 0 (protection contre la division par zéro). */
    public static BigDecimal pourcentage(BigDecimal part, BigDecimal total) {
        if (total.signum() == 0) {
            return ZERO;
        }
        return part.multiply(CENT).divide(total, ECHELLE, ARRONDI);
    }
}
