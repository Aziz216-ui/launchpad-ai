package com.launchpad.finance.domain.exception;

/**
 * Racine des exceptions métier. Le Domaine ne connaît aucun code HTTP :
 * seule la Présentation les traduit (atelier 5).
 */
public abstract class ExceptionMetier extends RuntimeException {

    protected ExceptionMetier(String message) {
        super(message);
    }
}
