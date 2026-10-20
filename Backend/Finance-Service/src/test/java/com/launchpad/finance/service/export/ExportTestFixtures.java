package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.SectionDocument;
import com.launchpad.finance.domain.TypeDocument;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

final class ExportTestFixtures {

    static final UUID DOCUMENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    private ExportTestFixtures() {
    }

    /** Document à deux sections : un tableau à deux colonnes et une section sans ligne mais avec note. */
    static DocumentFinancier document() {
        return new DocumentFinancier(DOCUMENT_ID, UUID.fromString("11111111-1111-1111-1111-111111111111"),
                TypeDocument.BUSINESS_PLAN, new ContenuDocument("Business plan - période 2026", List.of(
                new SectionDocument("Marges", List.of("Montant", "Taux (%)"), List.of(
                        LigneDocument.de("Marge brute", new BigDecimal("60000.00"), new BigDecimal("60.00")),
                        LigneDocument.de("Marge nette", new BigDecimal("-1234567.89"), new BigDecimal("-12.50"))),
                        List.of("Statut : EXCEDENT")),
                new SectionDocument("Projections pluriannuelles", List.of("Chiffre d'affaires", "Dépenses", "Marge"),
                        List.of(), List.of("Aucune projection pluriannuelle n'a été générée pour cette prévision.")))),
                Instant.parse("2026-03-01T10:15:30Z"));
    }
}
