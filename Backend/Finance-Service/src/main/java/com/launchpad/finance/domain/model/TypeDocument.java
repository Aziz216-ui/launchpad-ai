package com.launchpad.finance.domain.model;

public enum TypeDocument {
    BUSINESS_PLAN("Business plan"),
    BILAN_OUVERTURE("Bilan d'ouverture"),
    COMPTE_RESULTAT("Compte de résultat prévisionnel"),
    PLAN_TRESORERIE("Plan de trésorerie"),
    RAPPORT_INVESTISSEUR("Rapport investisseur");

    private final String libelle;

    TypeDocument(String libelle) {
        this.libelle = libelle;
    }

    public String libelle() {
        return libelle;
    }
}
