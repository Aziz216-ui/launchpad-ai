package com.launchpad.document.service.evenement;

import com.launchpad.document.domain.AvisPrevision;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.Notification;
import com.launchpad.document.domain.Notification.Destinataire;
import com.launchpad.document.domain.Notification.TypeNotification;
import com.launchpad.document.domain.PrevisionAValider;
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
 * Traitement métier des événements Finance reçus : produit une notification et la garde en mémoire (50 dernières).
 * L'envoi réel d'un e-mail ou d'une notification relèverait d'un service dédié ; ici il est simulé par un journal.
 * <ul>
 *   <li>document généré → tous les membres du projet ;</li>
 *   <li>prévision à valider → le financier ;</li>
 *   <li>avis (validée / rejetée) → le propriétaire.</li>
 * </ul>
 * RabbitMQ livre « au moins une fois » : le traitement est idempotent, un même événement n'est notifié qu'une fois.
 */
@Service
public class JournalNotifications {

    static final int CAPACITE = 50;

    private static final Logger LOG = LoggerFactory.getLogger(JournalNotifications.class);

    /** Clé = identifiant du document ou de l'événement, ordre d'arrivée conservé. */
    private final Map<UUID, Notification> notifications = new LinkedHashMap<>();

    public void enregistrer(DocumentGenere e) {
        ajouter(new Notification(e.documentId(), e.projetId(), TypeNotification.DOCUMENT_GENERE, Destinataire.TOUS,
                "Le document « " + e.titre() + " » est disponible.", Instant.now(), e.documentId(), null));
    }

    public void enregistrer(PrevisionAValider e) {
        ajouter(new Notification(e.evenementId(), e.projetId(), TypeNotification.PREVISION_A_VALIDER,
                Destinataire.FINANCIER, "La prévision " + e.periode() + " attend votre avis.", Instant.now(), null,
                e.previsionId()));
    }

    public void enregistrer(AvisPrevision e) {
        String message = (e.estValidee() ? "Votre prévision " + e.periode() + " a été validée par "
                : "Votre prévision " + e.periode() + " a été rejetée par ") + e.auteur()
                + (e.commentaire() == null ? "." : " : « " + e.commentaire() + " »");
        ajouter(new Notification(e.evenementId(), e.projetId(),
                e.estValidee() ? TypeNotification.PREVISION_VALIDEE : TypeNotification.PREVISION_REJETEE,
                Destinataire.PROPRIETAIRE, message, Instant.now(), null, e.previsionId()));
    }

    private synchronized void ajouter(Notification notification) {
        if (notification.cle() == null || notifications.containsKey(notification.cle())) {
            LOG.info("Événement déjà traité ou sans clé, ignoré : {}", notification.cle());
            return;
        }
        notifications.put(notification.cle(), notification);
        if (notifications.size() > CAPACITE) {
            UUID plusAncien = notifications.keySet().iterator().next();
            notifications.remove(plusAncien);
        }
        LOG.info("Notification ({}) pour le projet {} : {}", notification.pour(), notification.projetId(),
                notification.message());
    }

    /** Notifications d'un projet, de la plus récente à la plus ancienne. */
    public synchronized List<Notification> notificationsDuProjet(Long projetId) {
        List<Notification> liste = new ArrayList<>(
                notifications.values().stream().filter(n -> n.projetId().equals(projetId)).toList());
        Collections.reverse(liste);
        return liste;
    }
}
