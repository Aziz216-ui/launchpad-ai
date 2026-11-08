package com.launchpad.prevision.exception;

/**
 * Un microservice appelé (Document-Service) ne répond pas ou répond en erreur.
 * Le service appelant dégrade sa réponse (HTTP 503, ou message renvoyé au modèle) au lieu de planter.
 */
public class ServiceIndisponible extends ExceptionMetier {

    public ServiceIndisponible(String message) {
        super(message);
    }
}
