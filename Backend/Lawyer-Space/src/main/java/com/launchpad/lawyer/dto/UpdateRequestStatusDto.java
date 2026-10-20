package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.RequestStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateRequestStatusDto(
        @NotNull(message = "Status is required")
        RequestStatus status
) {
}
