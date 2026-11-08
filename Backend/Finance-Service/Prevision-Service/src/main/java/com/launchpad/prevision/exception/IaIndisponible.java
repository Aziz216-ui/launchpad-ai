package com.launchpad.prevision.exception;

/**
 * Le fournisseur LLM n'est pas configuré, ne répond pas à temps ou a renvoyé une erreur.
 * Les calculs financiers restent disponibles : seules les fonctions rédigées par l'IA sont touchées.
 */
public class IaIndisponible extends ExceptionMetier {

    public IaIndisponible(String message) {
        super(message);
    }
}
