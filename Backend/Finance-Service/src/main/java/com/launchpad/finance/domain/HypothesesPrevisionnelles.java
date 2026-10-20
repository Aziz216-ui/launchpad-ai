package com.launchpad.finance.domain;

import com.launchpad.finance.exception.DonneesInvalides;

import java.math.BigDecimal;

/**
 * Hypothèses du modèle prévisionnel : montants de base (année 0 = la prévision) et taux annuels en %
 * (10 = +10 % par an, -5 = -5 % par an).
 */
public record HypothesesPrevisionnelles(BigDecimal chiffreAffairesBase, BigDecimal depensesBase,
                                        BigDecimal tauxCa, BigDecimal tauxDepenses) {

    private static final BigDecimal TAUX_MINIMUM_EXCLU = BigDecimal.valueOf(-100);

    public HypothesesPrevisionnelles {
        chiffreAffairesBase = Montants.exigerPositifOuNul(chiffreAffairesBase, "Chiffre d'affaires de base");
        depensesBase = Montants.exigerPositifOuNul(depensesBase, "Dépenses de base");
        exigerTaux(tauxCa, "tauxCa");
        exigerTaux(tauxDepenses, "tauxDepenses");
    }

    public static HypothesesPrevisionnelles depuis(PrevisionFinanciere prevision, BigDecimal tauxCa,
                                                   BigDecimal tauxDepenses) {
        return new HypothesesPrevisionnelles(prevision.chiffreAffaires(), prevision.depenses(), tauxCa, tauxDepenses);
    }

    private static void exigerTaux(BigDecimal taux, String nom) {
        if (taux == null) {
            throw new DonneesInvalides(nom + " est obligatoire");
        }
        if (taux.compareTo(TAUX_MINIMUM_EXCLU) <= 0) {
            throw new DonneesInvalides(nom + " doit être strictement supérieur à -100 %");
        }
    }
}
