package com.launchpad.finance.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * Ligne de tableau : un libellé et une valeur numérique par colonne de la section.
 */
public record LigneDocument(String libelle, List<BigDecimal> valeurs) {

    public LigneDocument {
        valeurs = valeurs == null ? List.of() : List.copyOf(valeurs);
    }

    public static LigneDocument de(String libelle, BigDecimal... valeurs) {
        return new LigneDocument(libelle, List.of(valeurs));
    }
}
