package com.launchpad.finance.exception;

import java.util.UUID;

public class PrevisionIntrouvable extends ExceptionMetier {

    public PrevisionIntrouvable(UUID previsionId) {
        super("Prévision introuvable : " + previsionId);
    }

    private PrevisionIntrouvable(String message) {
        super(message);
    }

    public static PrevisionIntrouvable pourProjet(UUID projetId) {
        return new PrevisionIntrouvable("Aucune prévision pour le projet : " + projetId);
    }
}
