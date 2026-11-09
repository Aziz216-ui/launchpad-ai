package com.launchpad.document.controller;

import com.launchpad.document.dto.NotificationResponse;
import com.launchpad.document.service.evenement.JournalNotifications;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Notifications reçues via RabbitMQ : permet de vérifier que le message publié a bien été consommé.
 */
@Tag(name = "Notifications", description = "Notifications issues des événements RabbitMQ")
@RestController
@RequestMapping("/api/finance")
public class NotificationController {

    private final JournalNotifications journal;

    public NotificationController(JournalNotifications journal) {
        this.journal = journal;
    }

    @Operation(summary = "Notifications d'un projet reçues via RabbitMQ (documents générés)")
    @GetMapping("/projets/{projetId}/notifications")
    public List<NotificationResponse> notifications(@PathVariable Long projetId) {
        return journal.notificationsDuProjet(projetId).stream().map(NotificationResponse::depuis).toList();
    }
}
