package com.launchpad.prevision.domain;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Événement « une prévision attend l'avis d'un financier » : publié à la création d'une prévision et quand ses
 * chiffres changent (nouvelles projections). evenementId sert de clé de dédoublonnage aux consommateurs.
 */
public record PrevisionAValider(UUID evenementId, UUID previsionId, Long projetId, String periode, Instant le) {

    public static PrevisionAValider de(PrevisionFinanciere prevision) {
        return new PrevisionAValider(UUID.randomUUID(), prevision.id(), prevision.projetId(), prevision.periode(),
                Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
