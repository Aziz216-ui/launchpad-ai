package com.launchpad.prevision.exception;

public class MembreIntrouvable extends ExceptionMetier {

    public MembreIntrouvable(Long projetId, String email) {
        super("Aucun financier " + email + " sur le projet " + projetId);
    }
}
