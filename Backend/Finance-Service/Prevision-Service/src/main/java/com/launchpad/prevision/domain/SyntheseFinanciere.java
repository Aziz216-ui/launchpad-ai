package com.launchpad.prevision.domain;

/**
 * Vue d'ensemble de la dernière prévision d'un projet : la prévision (avec ses projections), ses marges et son écart.
 */
public record SyntheseFinanciere(PrevisionFinanciere prevision, Marges marges, EcartFinancier ecart) {
}
