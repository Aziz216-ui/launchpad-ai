package com.launchpad.finance.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CreerPrevisionRequest(
        @NotNull UUID projetId,
        @NotBlank @Size(max = 50) String periode,
        @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal chiffreAffaires,
        @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal coutsDirects,
        @NotNull @PositiveOrZero @Digits(integer = 13, fraction = 2) BigDecimal depenses) {
}
