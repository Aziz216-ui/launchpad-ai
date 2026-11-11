package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement reçu du Prevision-Service (clé finance.prevision.avis) : un financier a validé (VALIDEE) ou rejeté
 * (REJETEE) une prévision. Contrat JSON : voir CONTRAT-API.md.
 */
public record AvisPrevision(UUID evenementId, UUID previsionId, Long projetId, String periode, String statut,
                            String commentaire, String auteur, Instant le) {

    public boolean estValidee() {
        return "VALIDEE".equals(statut);
    }
}
