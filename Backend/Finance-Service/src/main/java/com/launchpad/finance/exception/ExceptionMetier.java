package com.launchpad.finance.exception;

/**
 * Racine des exceptions métier. Le code métier ne connaît aucun code HTTP :
 * seul GestionErreursAdvice les traduit (atelier 5).
 */
public abstract class ExceptionMetier extends RuntimeException {

    protected ExceptionMetier(String message) {
        super(message);
    }
}
