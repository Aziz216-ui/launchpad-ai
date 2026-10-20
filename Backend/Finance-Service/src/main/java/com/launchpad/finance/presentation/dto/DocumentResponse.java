package com.launchpad.finance.presentation.dto;

import com.launchpad.finance.domain.model.ContenuDocument;
import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.model.TypeDocument;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(UUID documentId, UUID projetId, TypeDocument type, Instant creeLe,
                               ContenuDocument contenu) {

    public static DocumentResponse depuis(DocumentFinancier d) {
        return new DocumentResponse(d.id(), d.projetId(), d.type(), d.creeLe(), d.contenu());
    }
}
