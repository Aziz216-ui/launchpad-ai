package com.launchpad.finance.dto;

import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.TypeDocument;

import java.time.Instant;
import java.util.UUID;

/**
 * Élément de la liste des documents d'un projet (sans le contenu).
 */
public record DocumentResumeResponse(UUID documentId, UUID projetId, TypeDocument type, String titre, Instant creeLe) {

    public static DocumentResumeResponse depuis(DocumentFinancier d) {
        return new DocumentResumeResponse(d.id(), d.projetId(), d.type(), d.contenu().titre(), d.creeLe());
    }
}
