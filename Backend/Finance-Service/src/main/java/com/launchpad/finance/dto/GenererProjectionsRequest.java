package com.launchpad.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Taux annuels en % (10 = +10 % par an) et horizon en années (1 à 10).
 */
public record GenererProjectionsRequest(
        @NotNull @DecimalMin(value = "-100", inclusive = false) @Digits(integer = 4, fraction = 2) BigDecimal tauxCa,
        @NotNull @DecimalMin(value = "-100", inclusive = false) @Digits(integer = 4, fraction = 2) BigDecimal tauxDepenses,
        @NotNull @Min(1) @Max(10) Integer horizon) {
}
