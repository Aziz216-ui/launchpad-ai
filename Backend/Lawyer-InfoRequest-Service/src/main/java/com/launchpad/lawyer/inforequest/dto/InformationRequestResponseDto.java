package com.launchpad.lawyer.inforequest.dto;

import com.launchpad.lawyer.inforequest.entity.InformationRequest;
import com.launchpad.lawyer.inforequest.entity.RequestStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record InformationRequestResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
        String clientEmail,
        String title,
        String description,
        String requestedItems,
        LocalDate dueDate,
        RequestStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static InformationRequestResponseDto fromEntity(InformationRequest req) {
        return new InformationRequestResponseDto(
                req.getId(),
                req.getLawyerId(),
                req.getClientId(),
                req.getClientName(),
                req.getClientEmail(),
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

