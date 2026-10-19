package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.Marges;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Marges d'une prévision ; les taux sont en % du chiffre d'affaires.
 */
public record MargesResponse(UUID previsionId, BigDecimal margeBrute, BigDecimal margeNette,
                             BigDecimal tauxMargeBrute, BigDecimal tauxMargeNette) {

    public static MargesResponse depuis(UUID previsionId, Marges m) {
        return new MargesResponse(previsionId, m.margeBrute(), m.margeNette(), m.tauxMargeBrute(), m.tauxMargeNette());
    }
}
