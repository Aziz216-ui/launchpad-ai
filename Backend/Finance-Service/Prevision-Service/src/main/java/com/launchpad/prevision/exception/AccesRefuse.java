package com.launchpad.prevision.exception;

/**
 * L'utilisateur est authentifié mais n'a pas le droit demandé sur ce projet (traduit en 403).
 */
public class AccesRefuse extends ExceptionMetier {

    public AccesRefuse(String message) {
        super(message);
    }
}
