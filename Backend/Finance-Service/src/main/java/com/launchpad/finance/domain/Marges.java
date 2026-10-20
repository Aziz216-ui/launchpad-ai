package com.launchpad.finance.domain;

import java.math.BigDecimal;

/**
 * Marges d'une prévision. Les taux sont exprimés en % du chiffre d'affaires.
 */
public record Marges(BigDecimal margeBrute, BigDecimal margeNette, BigDecimal tauxMargeBrute, BigDecimal tauxMargeNette) {
}
