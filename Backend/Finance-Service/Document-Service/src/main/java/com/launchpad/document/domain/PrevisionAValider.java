package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement reçu du Prevision-Service (clé finance.prevision.a-valider) : une prévision attend l'avis d'un
 * financier. Contrat JSON : voir CONTRAT-API.md.
 * <p>
 * motif : CREATION ou CHIFFRES_MODIFIES (nouvelles projections, l'avis précédent ne vaut plus). Absent dans les
 * messages plus anciens : traité comme une création.
 */
public record PrevisionAValider(UUID evenementId, UUID previsionId, Long projetId, String periode, Instant le,
                                String motif) {

    public static final String CHIFFRES_MODIFIES = "CHIFFRES_MODIFIES";

    public boolean chiffresModifies() {
        return CHIFFRES_MODIFIES.equals(motif);
    }
}
