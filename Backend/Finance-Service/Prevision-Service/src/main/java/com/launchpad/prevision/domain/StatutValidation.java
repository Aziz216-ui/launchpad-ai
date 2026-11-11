package com.launchpad.prevision.domain;

/**
 * Avis du financier sur une prévision. Une prévision naît EN_ATTENTE et y revient dès que ses chiffres
 * changent (nouvelles projections).
 */
public enum StatutValidation {
    EN_ATTENTE,
    VALIDEE,
    REJETEE
}
