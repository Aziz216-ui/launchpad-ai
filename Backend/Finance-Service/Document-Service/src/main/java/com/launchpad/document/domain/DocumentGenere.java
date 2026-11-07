package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement « un document financier vient d'être généré » : contrat de message échangé via RabbitMQ.
 * Il ne contient que des identifiants et des libellés (jamais le contenu du document), en JSON simple,
 * pour rester lisible par des services écrits dans d'autres langages.
 */
public record DocumentGenere(UUID documentId, UUID projetId, TypeDocument type, String titre, Instant creeLe) {

    public static DocumentGenere de(DocumentFinancier document) {
        return new DocumentGenere(document.id(), document.projetId(), document.type(), document.contenu().titre(),
                document.creeLe());
    }
}
