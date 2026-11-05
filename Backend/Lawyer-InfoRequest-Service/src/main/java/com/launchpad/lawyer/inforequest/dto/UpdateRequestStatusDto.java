package com.launchpad.lawyer.inforequest.dto;

import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateRequestStatusDto(
        @NotNull(message = "Status cannot be null")
        RequestStatus status
) {}

