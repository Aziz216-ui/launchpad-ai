package com.launchpad.finance.domain.service;

import com.launchpad.finance.domain.model.EcartFinancier;
import com.launchpad.finance.domain.model.Montants;
import com.launchpad.finance.domain.model.PrevisionFinanciere;
import com.launchpad.finance.domain.model.StatutEcart;

import java.math.BigDecimal;

/**
 * Compare revenus et dépenses d'une prévision : montant, pourcentage du CA et statut.
 */
public class ComparateurRevenusDepenses {

    public EcartFinancier comparer(PrevisionFinanciere prevision) {
        BigDecimal montant = Montants.arrondir(prevision.chiffreAffaires().subtract(prevision.depenses()));
        BigDecimal pourcentage = Montants.pourcentage(montant, prevision.chiffreAffaires());
        return new EcartFinancier(montant, pourcentage, StatutEcart.depuis(montant));
    }
}
