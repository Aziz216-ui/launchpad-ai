package com.launchpad.document.domain;

import com.launchpad.document.exception.DonneesInvalides;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Document financier généré pour un projet ; son contenu est conservé tel quel (jsonb).
 * {@code previsionId} : prévision dont il est tiré (null pour un document antérieur à ce suivi).
 * {@code certification} : null tant qu'aucun financier ne l'a certifié.
 */
public record DocumentFinancier(UUID id, Long projetId, TypeDocument type, ContenuDocument contenu, Instant creeLe,
                                UUID previsionId, Certification certification) {

    public DocumentFinancier {
        if (id == null || projetId == null || type == null || contenu == null || creeLe == null) {
            throw new DonneesInvalides("Document financier incomplet");
        }
    }

    /** Document non certifié, de prévision source inconnue. */
    public DocumentFinancier(UUID id, Long projetId, TypeDocument type, ContenuDocument contenu, Instant creeLe) {
        this(id, projetId, type, contenu, creeLe, null, null);
    }

    public static DocumentFinancier creer(Long projetId, TypeDocument type, ContenuDocument contenu) {
        return creer(projetId, type, contenu, null);
    }

    public static DocumentFinancier creer(Long projetId, TypeDocument type, ContenuDocument contenu, UUID previsionId) {
        return new DocumentFinancier(UUID.randomUUID(), projetId, type, contenu,
                Instant.now().truncatedTo(ChronoUnit.MICROS), previsionId, null);
    }

    public boolean estCertifie() {
        return certification != null;
    }

    /**
     * Un document se certifie une seule fois, et seulement si la prévision dont il est tiré a été validée par un
     * financier : on ne certifie pas un document bâti sur des chiffres non validés.
     *
     * @param statutPrevision statut de validation actuel de la prévision source
     */
    public DocumentFinancier certifier(Certification nouvelleCertification, String statutPrevision) {
        if (estCertifie()) {
            throw new DonneesInvalides("Ce document est déjà certifié par " + certification.auteur());
        }
        if (previsionId == null) {
            throw new DonneesInvalides("Document antérieur au suivi des prévisions : regénérez-le avant de le certifier");
        }
        if (!"VALIDEE".equals(statutPrevision)) {
            throw new DonneesInvalides("La prévision dont ce document est tiré doit d'abord être validée");
        }
        return new DocumentFinancier(id, projetId, type, contenu, creeLe, previsionId, nouvelleCertification);
    }
}
