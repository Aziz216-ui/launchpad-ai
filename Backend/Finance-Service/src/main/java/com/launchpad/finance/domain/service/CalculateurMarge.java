package com.launchpad.finance.domain.service;

import com.launchpad.finance.domain.model.Marges;
import com.launchpad.finance.domain.model.Montants;
import com.launchpad.finance.domain.model.PrevisionFinanciere;

import java.math.BigDecimal;

/**
 * Calcul des marges : brute = CA − coûts directs, nette = CA − dépenses, taux = marge / CA × 100.
 */
public class CalculateurMarge {

    public BigDecimal calculerMargeBrute(BigDecimal chiffreAffaires, BigDecimal coutsDirects) {
        return Montants.arrondir(chiffreAffaires.subtract(coutsDirects));
    }

    public BigDecimal calculerMargeNette(PrevisionFinanciere prevision) {
        return Montants.arrondir(prevision.calculerResultat());
    }

    /** Taux de marge en %, 0.00 si le CA est nul. */
    public BigDecimal calculerTauxMarge(BigDecimal marge, BigDecimal chiffreAffaires) {
        return Montants.pourcentage(marge, chiffreAffaires);
    }

    public Marges calculerMarges(PrevisionFinanciere prevision) {
        BigDecimal ca = prevision.chiffreAffaires();
        BigDecimal margeBrute = calculerMargeBrute(ca, prevision.coutsDirects());
        BigDecimal margeNette = calculerMargeNette(prevision);
        return new Marges(margeBrute, margeNette, calculerTauxMarge(margeBrute, ca), calculerTauxMarge(margeNette, ca));
    }
}
