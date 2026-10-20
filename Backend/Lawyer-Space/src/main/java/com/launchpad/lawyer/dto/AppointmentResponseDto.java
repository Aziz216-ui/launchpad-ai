package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.Appointment;
import com.launchpad.lawyer.entity.AppointmentStatus;

import java.time.LocalDateTime;

public record AppointmentResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
        String clientEmail,
        String title,
        String description,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String location,
        AppointmentStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AppointmentResponseDto fromEntity(Appointment appointment) {
        if (appointment == null) return null;
        return new AppointmentResponseDto(
                appointment.getId(),
                appointment.getLawyerId(),
                appointment.getClient().getId(),
                appointment.getClient().getFirstName() + " " + appointment.getClient().getLastName(),
                appointment.getClient().getEmail(),
                appointment.getTitle(),
                appointment.getDescription(),
                appointment.getStartTime(),
                appointment.getEndTime(),
                appointment.getLocation(),
                appointment.getStatus(),
                appointment.getCreatedAt(),
                appointment.getUpdatedAt()
        );
    }
}
