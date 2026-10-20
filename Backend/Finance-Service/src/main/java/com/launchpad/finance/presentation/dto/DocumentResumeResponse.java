package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.model.TypeDocument;

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
