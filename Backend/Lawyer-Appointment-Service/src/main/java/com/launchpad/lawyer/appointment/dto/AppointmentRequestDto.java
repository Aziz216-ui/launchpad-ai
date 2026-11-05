package com.launchpad.lawyer.appointment.dto;

import com.launchpad.lawyer.appointment.entity.AppointmentStatus;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record AppointmentRequestDto(
        @NotNull(message = "Client ID is required")
        Long clientId,

        @NotBlank(message = "Title is required")
        String title,

        String description,

        @NotNull(message = "Start time is required")
        @FutureOrPresent(message = "Appointment must be in the present or future")
        LocalDateTime startTime,

        @NotNull(message = "End time is required")
        LocalDateTime endTime,

        String location,
        AppointmentStatus status
) {}

