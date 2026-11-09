package com.launchpad.document.dto;

import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.TypeDocument;

import java.time.Instant;
import java.util.UUID;

/**
 * Élément de la liste des documents d'un projet (sans le contenu).
 */
public record DocumentResumeResponse(UUID documentId, Long projetId, TypeDocument type, String titre, Instant creeLe) {

    public static DocumentResumeResponse depuis(DocumentFinancier d) {
        return new DocumentResumeResponse(d.id(), d.projetId(), d.type(), d.contenu().titre(), d.creeLe());
    }
}
