package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Notification produite à la réception d'un événement Finance (document généré, prévision à valider, avis).
 *
 * @param cle         clé de dédoublonnage (identifiant du document ou de l'événement)
 * @param pour        à qui elle s'adresse sur le projet : propriétaire, financier ou tous
 * @param documentId  document concerné (null sinon)
 * @param previsionId prévision concernée (null sinon)
 */
public record Notification(UUID cle, Long projetId, TypeNotification type, Destinataire pour, String message,
                           Instant recueLe, UUID documentId, UUID previsionId) {

    public enum TypeNotification {
        DOCUMENT_GENERE,
        PREVISION_A_VALIDER,
        PREVISION_VALIDEE,
        PREVISION_REJETEE
    }

    public enum Destinataire {
        PROPRIETAIRE,
        FINANCIER,
        TOUS
    }

    /** La notification est-elle destinée à un utilisateur ayant ces droits sur le projet ? */
    public boolean visiblePar(DroitsProjet droits) {
        return switch (pour) {
            case TOUS -> droits.lecture();
            case PROPRIETAIRE -> droits.ecriture();
            case FINANCIER -> droits.validation();
        };
    }
}
