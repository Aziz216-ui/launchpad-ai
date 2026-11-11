package com.launchpad.document.dto;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.TypeDocument;

import java.time.Instant;
import java.util.UUID;

/**
 * previsionId : prévision dont le document est tiré (null pour un document ancien).
 * certification : null tant que le document n'est pas certifié par un financier.
 */
public record DocumentResponse(UUID documentId, Long projetId, TypeDocument type, Instant creeLe,
                               ContenuDocument contenu, UUID previsionId, CertificationResponse certification) {

    public static DocumentResponse depuis(DocumentFinancier d) {
        return new DocumentResponse(d.id(), d.projetId(), d.type(), d.creeLe(), d.contenu(), d.previsionId(),
                CertificationResponse.depuis(d.certification()));
    }
}
