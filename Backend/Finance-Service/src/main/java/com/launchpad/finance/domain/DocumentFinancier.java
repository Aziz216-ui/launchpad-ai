package com.launchpad.finance.domain;

import com.launchpad.finance.exception.DonneesInvalides;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Document financier généré pour un projet ; son contenu est conservé tel quel (jsonb).
 */
public record DocumentFinancier(UUID id, UUID projetId, TypeDocument type, ContenuDocument contenu, Instant creeLe) {

    public DocumentFinancier {
        if (id == null || projetId == null || type == null || contenu == null || creeLe == null) {
            throw new DonneesInvalides("Document financier incomplet");
        }
    }

    public static DocumentFinancier creer(UUID projetId, TypeDocument type, ContenuDocument contenu) {
        return new DocumentFinancier(UUID.randomUUID(), projetId, type, contenu,
                Instant.now().truncatedTo(ChronoUnit.MICROS));
    }
}
