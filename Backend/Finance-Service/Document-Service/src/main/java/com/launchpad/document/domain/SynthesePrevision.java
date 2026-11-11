package com.launchpad.document.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Dernière prévision d'un projet avec ses marges, son écart et ses projections, calculés par le Prevision-Service.
 * Le Document-Service n'en recalcule rien : il met ces chiffres en forme dans les tableaux des documents.
 * {@code previsionId} identifie la prévision source (null si inconnue).
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
        List<ProjectionSynthese> projections,
        UUID previsionId) {

    public SynthesePrevision {
        projections = projections == null ? List.of() : List.copyOf(projections);
    }

    /** Synthèse sans identifiant de prévision connu. */
    public SynthesePrevision(String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects, BigDecimal depenses,
                             BigDecimal resultat, BigDecimal margeBrute, BigDecimal margeNette,
                             BigDecimal tauxMargeBrute, BigDecimal tauxMargeNette, BigDecimal ecartMontant,
                             BigDecimal ecartPourcentage, String ecartStatut, List<ProjectionSynthese> projections) {
        this(periode, chiffreAffaires, coutsDirects, depenses, resultat, margeBrute, margeNette, tauxMargeBrute,
                tauxMargeNette, ecartMontant, ecartPourcentage, ecartStatut, projections, null);
    }
}
