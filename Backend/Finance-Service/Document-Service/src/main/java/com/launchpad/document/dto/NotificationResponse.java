package com.launchpad.document.dto;

import com.launchpad.document.domain.NotificationDocument;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(UUID documentId, UUID projetId, String message, Instant recueLe) {

    public static NotificationResponse depuis(NotificationDocument n) {
        return new NotificationResponse(n.documentId(), n.projetId(), n.message(), n.recueLe());
    }
}
