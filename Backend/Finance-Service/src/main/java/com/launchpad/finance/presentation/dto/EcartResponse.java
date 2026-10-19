package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.EcartFinancier;
import com.launchpad.finance.domain.model.StatutEcart;

import java.math.BigDecimal;
import java.util.UUID;

public record EcartResponse(UUID previsionId, BigDecimal montant, BigDecimal pourcentage, StatutEcart statut) {

    public static EcartResponse depuis(UUID previsionId, EcartFinancier e) {
        return new EcartResponse(previsionId, e.montant(), e.pourcentage(), e.statut());
    }
}
