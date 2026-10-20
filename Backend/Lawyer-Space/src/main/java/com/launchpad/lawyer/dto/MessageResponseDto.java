package com.launchpad.lawyer.dto;

import com.launchpad.lawyer.entity.Message;
import com.launchpad.lawyer.entity.SenderType;

import java.time.LocalDateTime;

public record MessageResponseDto(
        Long id,
        String lawyerId,
        Long clientId,
        String clientName,
        SenderType senderType,
        String subject,
        String content,
        LocalDateTime sentAt,
        boolean isRead
) {
    public static MessageResponseDto fromEntity(Message message) {
        if (message == null) return null;
        return new MessageResponseDto(
                message.getId(),
                message.getLawyerId(),
                message.getClient().getId(),
                message.getClient().getFirstName() + " " + message.getClient().getLastName(),
                message.getSenderType(),
                message.getSubject(),
                message.getContent(),
                message.getSentAt(),
                message.isRead()
        );
    }
}
