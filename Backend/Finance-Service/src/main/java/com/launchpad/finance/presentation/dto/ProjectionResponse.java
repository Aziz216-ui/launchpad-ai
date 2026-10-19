package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.ProjectionFinanciere;

import java.math.BigDecimal;

public record ProjectionResponse(int annee, BigDecimal chiffreAffaires, BigDecimal depenses, BigDecimal marge) {

    public static ProjectionResponse depuis(ProjectionFinanciere p) {
        return new ProjectionResponse(p.annee(), p.chiffreAffaires(), p.depenses(), p.marge());
    }
}
