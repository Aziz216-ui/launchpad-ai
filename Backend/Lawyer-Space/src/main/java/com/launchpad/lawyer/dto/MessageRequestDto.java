package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.SenderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MessageRequestDto(
        @NotNull(message = "Client ID is required")
        Long clientId,

        SenderType senderType,

        @NotBlank(message = "Subject is required")
        String subject,

        @NotBlank(message = "Content is required")
        String content
) {
}
