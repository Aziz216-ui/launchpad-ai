package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FormatExport;

/**
 * Patron Strategy : algorithme de mise en forme d'un document dans un format de fichier.
 * Ajouter un format = ajouter une implémentation (et sa valeur de FormatExport).
 */
public interface StrategieExport {

    /** Format produit par cette stratégie. */
    FormatExport format();

    byte[] exporter(DocumentFinancier document);
}
