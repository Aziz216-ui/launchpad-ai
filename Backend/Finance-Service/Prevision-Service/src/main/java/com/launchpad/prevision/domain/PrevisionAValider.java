package com.launchpad.prevision.domain;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Événement « une prévision attend l'avis d'un financier ». evenementId sert de clé de dédoublonnage.
 * <p>
 * motif : CREATION (nouvelle prévision) ou CHIFFRES_MODIFIES (nouvelles projections : l'avis précédent ne vaut
 * plus). Dans le second cas, tout le projet est concerné, propriétaire compris.
 */
public record PrevisionAValider(UUID evenementId, UUID previsionId, Long projetId, String periode, Instant le,
                                String motif) {

    public static final String CREATION = "CREATION";
    public static final String CHIFFRES_MODIFIES = "CHIFFRES_MODIFIES";

    /** Nouvelle prévision. */
    public static PrevisionAValider de(PrevisionFinanciere prevision) {
        return creer(prevision, CREATION);
    }

    /** Prévision dont les chiffres ont changé alors qu'un avis avait été donné. */
    public static PrevisionAValider apresModification(PrevisionFinanciere prevision) {
        return creer(prevision, CHIFFRES_MODIFIES);
    }

    private static PrevisionAValider creer(PrevisionFinanciere prevision, String motif) {
        return new PrevisionAValider(UUID.randomUUID(), prevision.id(), prevision.projetId(), prevision.periode(),
                Instant.now().truncatedTo(ChronoUnit.MICROS), motif);
    }
}
