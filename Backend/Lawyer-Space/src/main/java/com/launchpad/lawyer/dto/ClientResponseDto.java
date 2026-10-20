package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.Client;
import com.launchpad.lawyer.entity.ClientStatus;

import java.time.LocalDateTime;

public record ClientResponseDto(
        Long id,
        String lawyerId,
        String firstName,
        String lastName,
        String fullName,
        String email,
        String phone,
        String company,
        String address,
        String notes,
        ClientStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ClientResponseDto fromEntity(Client client) {
        if (client == null) return null;
        return new ClientResponseDto(
                client.getId(),
                client.getLawyerId(),
                client.getFirstName(),
                client.getLastName(),
                client.getFirstName() + " " + client.getLastName(),
                client.getEmail(),
                client.getPhone(),
                client.getCompany(),
                client.getAddress(),
                client.getNotes(),
                client.getStatus(),
                client.getCreatedAt(),
                client.getUpdatedAt()
        );
    }
}
