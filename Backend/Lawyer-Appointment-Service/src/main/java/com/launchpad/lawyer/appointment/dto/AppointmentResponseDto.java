package com.launchpad.lawyer.appointment.dto;

import com.launchpad.lawyer.appointment.entity.Appointment;
import com.launchpad.lawyer.appointment.entity.AppointmentStatus;
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
        return new AppointmentResponseDto(
                appointment.getId(),
                appointment.getLawyerId(),
                appointment.getClientId(),
                appointment.getClientName(),
                appointment.getClientEmail(),
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

