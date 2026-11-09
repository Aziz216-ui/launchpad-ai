package com.launchpad.prevision.exception;

import java.util.UUID;

public class PrevisionIntrouvable extends ExceptionMetier {

    public PrevisionIntrouvable(UUID previsionId) {
        super("Prévision introuvable : " + previsionId);
    }

    private PrevisionIntrouvable(String message) {
        super(message);
    }

    public static PrevisionIntrouvable pourProjet(Long projetId) {
        return new PrevisionIntrouvable("Aucune prévision pour le projet : " + projetId);
    }
}
