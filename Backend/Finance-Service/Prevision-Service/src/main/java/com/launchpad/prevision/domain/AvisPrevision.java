package com.launchpad.prevision.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement « un financier a validé ou rejeté une prévision », destiné au propriétaire du projet.
 * evenementId sert de clé de dédoublonnage aux consommateurs.
 */
public record AvisPrevision(UUID evenementId, UUID previsionId, Long projetId, String periode,
                            StatutValidation statut, String commentaire, String auteur, Instant le) {

    public static AvisPrevision de(PrevisionFinanciere prevision, ValidationPrevision avis) {
        return new AvisPrevision(UUID.randomUUID(), prevision.id(), prevision.projetId(), prevision.periode(),
                avis.statut(), avis.commentaire(), avis.auteur(), avis.le());
    }
}
