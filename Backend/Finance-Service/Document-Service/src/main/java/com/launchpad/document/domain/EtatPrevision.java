package com.launchpad.document.domain;

/**
 * État actuel d'une prévision, lu au Prevision-Service au moment de certifier un document :
 * son statut de validation (EN_ATTENTE, VALIDEE, REJETEE) et l'empreinte de ses chiffres.
 */
public record EtatPrevision(String statut, String empreinte) {

    public boolean estValidee() {
        return "VALIDEE".equals(statut);
    }
}
