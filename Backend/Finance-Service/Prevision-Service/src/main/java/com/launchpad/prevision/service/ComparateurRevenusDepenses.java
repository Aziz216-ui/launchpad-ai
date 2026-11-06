package com.launchpad.prevision.service;

import com.launchpad.prevision.domain.EcartFinancier;
import com.launchpad.prevision.domain.Montants;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.StatutEcart;

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
