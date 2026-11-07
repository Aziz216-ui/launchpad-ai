package com.launchpad.lawyer.message.dto;

import com.launchpad.lawyer.message.entity.SenderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MessageRequestDto(
        @NotNull(message = "Client ID is required")
        Long clientId,

        SenderType senderType,

        @NotBlank(message = "Subject is required")
        String subject,

        @NotBlank(message = "Message content cannot be blank")
        String content
) {}

