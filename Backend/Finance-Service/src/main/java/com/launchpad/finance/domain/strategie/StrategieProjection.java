package com.launchpad.finance.domain.strategie;

import com.launchpad.finance.domain.model.HypothesesPrevisionnelles;

import java.math.BigDecimal;

/**
 * Patron Strategy : algorithme de projection utilisé par le ModelePrevisionnel.
 * Ajouter une variante = ajouter une implémentation, sans modifier l'existant.
 */
public interface StrategieProjection {

    /** Chiffre d'affaires projeté pour l'année n (n ≥ 1). */
    BigDecimal projeterChiffreAffaires(HypothesesPrevisionnelles hypotheses, int annee);

    /** Dépenses projetées pour l'année n (n ≥ 1). */
    BigDecimal projeterDepenses(HypothesesPrevisionnelles hypotheses, int annee);
}
