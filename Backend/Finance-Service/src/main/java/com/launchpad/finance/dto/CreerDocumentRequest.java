package com.launchpad.finance.dto;

import com.launchpad.finance.domain.TypeDocument;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * tresorerieInitiale est facultative (0 par défaut) ; elle sert au bilan d'ouverture et au plan de trésorerie.
 */
public record CreerDocumentRequest(
        @NotNull UUID projetId,
        @NotNull TypeDocument type,
        @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal tresorerieInitiale) {
}
