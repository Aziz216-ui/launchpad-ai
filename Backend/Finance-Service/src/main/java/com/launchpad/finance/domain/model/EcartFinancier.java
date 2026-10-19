package com.launchpad.finance.domain.model;

import java.math.BigDecimal;

/**
 * Écart revenus / dépenses : montant = CA − dépenses, pourcentage = montant / CA × 100.
 */
public record EcartFinancier(BigDecimal montant, BigDecimal pourcentage, StatutEcart statut) {
}
