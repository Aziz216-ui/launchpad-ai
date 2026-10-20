package com.launchpad.finance.dto;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.TypeDocument;

import java.time.Instant;
import java.util.UUID;

public record DocumentResponse(UUID documentId, UUID projetId, TypeDocument type, Instant creeLe,
                               ContenuDocument contenu) {

    public static DocumentResponse depuis(DocumentFinancier d) {
        return new DocumentResponse(d.id(), d.projetId(), d.type(), d.creeLe(), d.contenu());
    }
}
