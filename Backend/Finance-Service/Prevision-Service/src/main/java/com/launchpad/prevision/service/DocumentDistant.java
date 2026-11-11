package com.launchpad.prevision.service;

import com.launchpad.prevision.domain.TypeDocument;

import java.util.UUID;

/**
 * Port vers le Document-Service (patron Adapter : implémenté par DocumentDistantRest).
 * Toute défaillance du service distant est signalée par ServiceIndisponible.
 */
public interface DocumentDistant {

    /** Demande la génération d'un document (sans analyse IA) et renvoie son identifiant. */
    UUID genererDocument(Long projetId, TypeDocument type);
}
