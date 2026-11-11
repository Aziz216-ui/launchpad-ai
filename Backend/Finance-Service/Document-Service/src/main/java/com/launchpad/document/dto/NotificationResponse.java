package com.launchpad.document.dto;

import com.launchpad.document.domain.Notification;
import com.launchpad.document.domain.Notification.Destinataire;
import com.launchpad.document.domain.Notification.TypeNotification;

import java.time.Instant;
import java.util.UUID;

/** documentId ou previsionId selon le type ; l'autre vaut null. */
public record NotificationResponse(TypeNotification type, Destinataire pour, Long projetId, String message,
                                   Instant recueLe, UUID documentId, UUID previsionId) {

    public static NotificationResponse depuis(Notification n) {
        return new NotificationResponse(n.type(), n.pour(), n.projetId(), n.message(), n.recueLe(), n.documentId(),
                n.previsionId());
    }
}
