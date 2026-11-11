package com.launchpad.document.domain;

import com.launchpad.document.exception.DonneesInvalides;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Document financier généré pour un projet ; son contenu est conservé tel quel (jsonb).
 * {@code previsionId} et {@code empreintePrevision} : prévision dont il est tiré et empreinte des chiffres utilisés
 * (null pour un document antérieur à ce suivi).
 * {@code certification} : null tant qu'aucun financier ne l'a certifié.
 */
public record DocumentFinancier(UUID id, Long projetId, TypeDocument type, ContenuDocument contenu, Instant creeLe,
                                UUID previsionId, String empreintePrevision, Certification certification) {

    public DocumentFinancier {
        if (id == null || projetId == null || type == null || contenu == null || creeLe == null) {
            throw new DonneesInvalides("Document financier incomplet");
        }
    }

    /** Document non certifié, de prévision source inconnue. */
    public DocumentFinancier(UUID id, Long projetId, TypeDocument type, ContenuDocument contenu, Instant creeLe) {
        this(id, projetId, type, contenu, creeLe, null, null, null);
    }

    public static DocumentFinancier creer(Long projetId, TypeDocument type, ContenuDocument contenu) {
        return creer(projetId, type, contenu, null, null);
    }

    public static DocumentFinancier creer(Long projetId, TypeDocument type, ContenuDocument contenu, UUID previsionId,
                                          String empreintePrevision) {
        return new DocumentFinancier(UUID.randomUUID(), projetId, type, contenu,
                Instant.now().truncatedTo(ChronoUnit.MICROS), previsionId, empreintePrevision, null);
    }

    public boolean estCertifie() {
        return certification != null;
    }

    /**
     * Un document se certifie une seule fois, et seulement s'il reflète la prévision VALIDÉE : la prévision dont il
     * est tiré doit être validée par un financier, et ses chiffres ne doivent pas avoir changé depuis la génération
     * du document (sinon, le financier certifierait des chiffres qu'il n'a pas validés).
     *
     * @param prevision état actuel de la prévision source (null si le document n'en a pas)
     */
    public DocumentFinancier certifier(Certification nouvelleCertification, EtatPrevision prevision) {
        if (estCertifie()) {
            throw new DonneesInvalides("Ce document est déjà certifié par " + certification.auteur());
        }
        if (previsionId == null || empreintePrevision == null || prevision == null) {
            throw new DonneesInvalides("Document antérieur au suivi des prévisions : regénérez-le avant de le certifier");
        }
        if (!prevision.estValidee()) {
            throw new DonneesInvalides("La prévision dont ce document est tiré doit d'abord être validée");
        }
        if (!empreintePrevision.equals(prevision.empreinte())) {
            throw new DonneesInvalides("La prévision a été modifiée depuis la génération de ce document "
                    + "(montants ou projections) : regénérez-le avant de le certifier");
        }
        return new DocumentFinancier(id, projetId, type, contenu, creeLe, previsionId, empreintePrevision,
                nouvelleCertification);
    }
}
