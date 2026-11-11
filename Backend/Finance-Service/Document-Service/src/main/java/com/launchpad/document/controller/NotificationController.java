package com.launchpad.document.controller;

import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.dto.NotificationResponse;
import com.launchpad.document.service.acces.ControleAcces;
import com.launchpad.document.service.evenement.JournalNotifications;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


/**
 * Notifications reçues via RabbitMQ (documents générés, prévisions à valider, avis du financier), filtrées selon
 * le rôle de l'utilisateur sur le projet : le propriétaire voit les avis, le financier les prévisions à valider.
 */
@Tag(name = "Notifications", description = "Notifications issues des événements RabbitMQ")
@RestController
@RequestMapping("/api/finance")
public class NotificationController {

    private final JournalNotifications journal;
    private final ControleAcces controleAcces;

    public NotificationController(JournalNotifications journal, ControleAcces controleAcces) {
        this.journal = journal;
        this.controleAcces = controleAcces;
    }

    @Operation(summary = "Notifications d'un projet destinées à l'utilisateur courant, de la plus récente à la plus ancienne")
    @GetMapping("/projets/{projetId}/notifications")
    public List<NotificationResponse> notifications(@PathVariable Long projetId) {
        DroitsProjet droits = controleAcces.exigerLecture(projetId);
        return journal.notificationsDuProjet(projetId).stream()
                .filter(n -> n.visiblePar(droits))
                .map(NotificationResponse::depuis).toList();
    }
}
