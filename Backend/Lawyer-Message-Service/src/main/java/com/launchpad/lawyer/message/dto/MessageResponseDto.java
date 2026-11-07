package com.launchpad.lawyer.message.dto;

import com.launchpad.lawyer.message.entity.Message;
import com.launchpad.lawyer.message.entity.SenderType;
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
        return new MessageResponseDto(
                message.getId(),
                message.getLawyerId(),
                message.getClientId(),
                message.getClientName(),
                message.getSenderType(),
                message.getSubject(),
                message.getContent(),
                message.getSentAt(),
                message.isRead()
        );
    }
}

