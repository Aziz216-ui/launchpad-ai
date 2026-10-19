package com.launchpad.finance.domain.model;

import com.launchpad.finance.domain.exception.DonneesInvalides;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Prévision financière d'un projet sur une période. Relation 1 → * avec {@link ProjectionFinanciere}.
 * Les dépenses incluent les coûts directs (coutsDirects ≤ depenses).
 */
public record PrevisionFinanciere(
        UUID id,
        UUID projetId,
        String periode,
        BigDecimal chiffreAffaires,
        BigDecimal coutsDirects,
        BigDecimal depenses,
        Instant creeLe,
        List<ProjectionFinanciere> projections) {

    public static final int PERIODE_LONGUEUR_MAX = 50;

    public PrevisionFinanciere {
        if (id == null) {
            throw new DonneesInvalides("L'identifiant de la prévision est obligatoire");
        }
        if (projetId == null) {
            throw new DonneesInvalides("projetId est obligatoire");
        }
        if (periode == null || periode.isBlank()) {
            throw new DonneesInvalides("periode est obligatoire");
        }
        periode = periode.strip();
        if (periode.length() > PERIODE_LONGUEUR_MAX) {
            throw new DonneesInvalides("periode ne doit pas dépasser " + PERIODE_LONGUEUR_MAX + " caractères");
        }
        chiffreAffaires = Montants.exigerPositifOuNul(chiffreAffaires, "chiffreAffaires");
        coutsDirects = Montants.exigerPositifOuNul(coutsDirects, "coutsDirects");
        depenses = Montants.exigerPositifOuNul(depenses, "depenses");
        if (coutsDirects.compareTo(depenses) > 0) {
            throw new DonneesInvalides("coutsDirects ne peut pas dépasser depenses (les dépenses incluent les coûts directs)");
        }
        if (creeLe == null) {
            throw new DonneesInvalides("La date de création est obligatoire");
        }
        projections = projections == null ? List.of() : List.copyOf(projections);
    }

    /** Nouvelle prévision (identifiant généré, sans projection). */
    public static PrevisionFinanciere creer(UUID projetId, String periode, BigDecimal chiffreAffaires,
                                            BigDecimal coutsDirects, BigDecimal depenses) {
        return new PrevisionFinanciere(UUID.randomUUID(), projetId, periode, chiffreAffaires, coutsDirects,
                depenses, Instant.now().truncatedTo(ChronoUnit.MICROS), List.of());
    }

    /** Résultat = CA − dépenses (= marge nette). */
    public BigDecimal calculerResultat() {
        return chiffreAffaires.subtract(depenses);
    }

    public PrevisionFinanciere avecProjections(List<ProjectionFinanciere> nouvellesProjections) {
        return new PrevisionFinanciere(id, projetId, periode, chiffreAffaires, coutsDirects, depenses, creeLe,
                nouvellesProjections);
    }
}
