package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.PrevisionFinanciere;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PrevisionResponse(
        UUID previsionId,
        UUID projetId,
        String periode,
        BigDecimal chiffreAffaires,
        BigDecimal coutsDirects,
        BigDecimal depenses,
        BigDecimal resultat,
        Instant creeLe,
        List<ProjectionResponse> projections) {

    public static PrevisionResponse depuis(PrevisionFinanciere p) {
        return new PrevisionResponse(p.id(), p.projetId(), p.periode(), p.chiffreAffaires(), p.coutsDirects(),
                p.depenses(), p.calculerResultat(), p.creeLe(),
                p.projections().stream().map(ProjectionResponse::depuis).toList());
    }
}
