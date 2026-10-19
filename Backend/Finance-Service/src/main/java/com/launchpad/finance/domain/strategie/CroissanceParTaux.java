package com.launchpad.finance.domain.strategie;

import com.launchpad.finance.domain.model.HypothesesPrevisionnelles;
import com.launchpad.finance.domain.model.Montants;

import java.math.BigDecimal;

/**
 * Stratégie de projection par croissance composée :
 * CA(n) = CA × (1 + tauxCa/100)^n et dépenses(n) = dépenses × (1 + tauxDepenses/100)^n.
 */
public class CroissanceParTaux implements StrategieProjection {

    @Override
    public BigDecimal projeterChiffreAffaires(HypothesesPrevisionnelles hypotheses, int annee) {
        return appliquer(hypotheses.chiffreAffairesBase(), hypotheses.tauxCa(), annee, "Chiffre d'affaires projeté");
    }

    @Override
    public BigDecimal projeterDepenses(HypothesesPrevisionnelles hypotheses, int annee) {
        return appliquer(hypotheses.depensesBase(), hypotheses.tauxDepenses(), annee, "Dépenses projetées");
    }

    private static BigDecimal appliquer(BigDecimal base, BigDecimal tauxPourcent, int annee, String nom) {
        BigDecimal facteur = BigDecimal.ONE.add(tauxPourcent.movePointLeft(2));
        // Calcul exact puis un seul arrondi final, pour ne pas cumuler les erreurs d'arrondi d'une année à l'autre.
        return Montants.exiger(base.multiply(facteur.pow(annee)), nom + " (année " + annee + ")");
    }
}
