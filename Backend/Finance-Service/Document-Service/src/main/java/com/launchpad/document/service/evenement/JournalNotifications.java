package com.launchpad.document.service.evenement;

import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.NotificationDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Traitement métier d'un événement reçu : produit une notification et la garde en mémoire (50 dernières).
 * L'envoi réel d'un e-mail ou d'une notification relèverait d'un service dédié ; ici il est simulé par un journal.
 * <p>
 * RabbitMQ livre « au moins une fois » : le traitement est idempotent, un même document n'est notifié qu'une fois.
 */
@Service
public class JournalNotifications {

    static final int CAPACITE = 50;

    private static final Logger LOG = LoggerFactory.getLogger(JournalNotifications.class);

    /** Clé = identifiant du document, ordre d'arrivée conservé. */
    private final Map<UUID, NotificationDocument> notifications = new LinkedHashMap<>();

    public synchronized void enregistrer(DocumentGenere evenement) {
        if (notifications.containsKey(evenement.documentId())) {
            LOG.info("Événement déjà traité, ignoré : document {}", evenement.documentId());
            return;
        }
        NotificationDocument notification = new NotificationDocument(evenement.documentId(), evenement.projetId(),
                "Votre document « " + evenement.titre() + " » est disponible.", Instant.now());
        notifications.put(evenement.documentId(), notification);
        if (notifications.size() > CAPACITE) {
            UUID plusAncien = notifications.keySet().iterator().next();
            notifications.remove(plusAncien);
        }
        LOG.info("Notification envoyée au projet {} : {}", notification.projetId(), notification.message());
    }

    /** Notifications d'un projet, de la plus récente à la plus ancienne. */
    public synchronized List<NotificationDocument> notificationsDuProjet(UUID projetId) {
        List<NotificationDocument> liste = new ArrayList<>(
                notifications.values().stream().filter(n -> n.projetId().equals(projetId)).toList());
        Collections.reverse(liste);
        return liste;
    }
}
