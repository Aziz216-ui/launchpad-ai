package com.launchpad.finance.domain.model;

import com.launchpad.finance.domain.exception.DonneesInvalides;

import java.math.BigDecimal;

/**
 * Projection d'une prévision pour l'année n (1..horizon) : CA(n), dépenses(n), marge(n) = résultat(n).
 */
public record ProjectionFinanciere(int annee, BigDecimal chiffreAffaires, BigDecimal depenses, BigDecimal marge) {

    public ProjectionFinanciere {
        if (annee < 1) {
            throw new DonneesInvalides("L'année d'une projection commence à 1");
        }
        chiffreAffaires = Montants.exiger(chiffreAffaires, "Chiffre d'affaires projeté (année " + annee + ")");
        depenses = Montants.exiger(depenses, "Dépenses projetées (année " + annee + ")");
        marge = Montants.exiger(marge, "Marge projetée (année " + annee + ")");
    }

    /** Construit la projection en calculant marge = CA − dépenses. */
    public static ProjectionFinanciere de(int annee, BigDecimal chiffreAffaires, BigDecimal depenses) {
        return new ProjectionFinanciere(annee, chiffreAffaires, depenses, chiffreAffaires.subtract(depenses));
    }
}
