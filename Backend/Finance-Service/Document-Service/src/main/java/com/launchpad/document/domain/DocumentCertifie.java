package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement « un financier a certifié un document » (clé finance.document.certifie), destiné au propriétaire du
 * projet : le document est prêt à être envoyé à un investisseur. documentId sert de clé de dédoublonnage (un
 * document ne se certifie qu'une fois).
 */
public record DocumentCertifie(UUID documentId, Long projetId, TypeDocument type, String titre, String auteur,
                               String commentaire, Instant le) {

    public static DocumentCertifie de(DocumentFinancier document) {
        Certification c = document.certification();
        return new DocumentCertifie(document.id(), document.projetId(), document.type(), document.contenu().titre(),
                c.auteur(), c.commentaire(), c.le());
    }
}
