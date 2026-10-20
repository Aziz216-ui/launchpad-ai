package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.InformationRequest;
import com.launchpad.lawyer.entity.RequestStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record InformationRequestResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
        String title,
        String description,
        String requestedItems,
        LocalDate dueDate,
        RequestStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static InformationRequestResponseDto fromEntity(InformationRequest req) {
        if (req == null) return null;
        return new InformationRequestResponseDto(
                req.getId(),
                req.getLawyerId(),
                req.getClient().getId(),
                req.getClient().getFirstName() + " " + req.getClient().getLastName(),
                req.getTitle(),
                req.getDescription(),
                req.getRequestedItems(),
                req.getDueDate(),
                req.getStatus(),
                req.getCreatedAt(),
                req.getUpdatedAt()
        );
    }
}
