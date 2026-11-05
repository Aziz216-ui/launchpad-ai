package com.launchpad.lawyer.inforequest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record InformationRequestDto(
        @NotNull(message = "Client ID is required")
        Long clientId,

        @NotBlank(message = "Title is required")
        String title,

        String description,
        String requestedItems,
        LocalDate dueDate
) {}

