package com.launchpad.document.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * Dernière prévision d'un projet avec ses marges, son écart et ses projections, calculés par le Prevision-Service.
 * Le Document-Service n'en recalcule rien : il met ces chiffres en forme dans les tableaux des documents.
 */
public record SynthesePrevision(
        String periode,
        BigDecimal chiffreAffaires,
        BigDecimal coutsDirects,
        BigDecimal depenses,
        BigDecimal resultat,
        BigDecimal margeBrute,
        BigDecimal margeNette,
        BigDecimal tauxMargeBrute,
        BigDecimal tauxMargeNette,
        BigDecimal ecartMontant,
        BigDecimal ecartPourcentage,
        String ecartStatut,
        List<ProjectionSynthese> projections) {

    public SynthesePrevision {
        projections = projections == null ? List.of() : List.copyOf(projections);
    }
}
