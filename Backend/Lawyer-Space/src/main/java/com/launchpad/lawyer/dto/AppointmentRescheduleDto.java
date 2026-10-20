package com.launchpad.lawyer.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record AppointmentRescheduleDto(
        @NotNull(message = "New start time is required")
        LocalDateTime newStartTime,

        @NotNull(message = "New end time is required")
        LocalDateTime newEndTime,

        String location
) {
}
