package com.launchpad.lawyer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DocumentReviewRequestDto(
        @NotNull(message = "Client ID is required")
        Long clientId,

        @NotBlank(message = "Document title is required")
        String documentTitle,

        @NotBlank(message = "Document type is required")
        String documentType,

        @NotBlank(message = "Document URL is required")
        String documentUrl
) {
}
