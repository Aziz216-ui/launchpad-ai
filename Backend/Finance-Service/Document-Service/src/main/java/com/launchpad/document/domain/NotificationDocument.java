package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Notification produite à la réception d'un événement DocumentGenere.
 */
public record NotificationDocument(UUID documentId, Long projetId, String message, Instant recueLe) {
}
