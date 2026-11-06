package com.launchpad.document.service.export;

import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.FormatExport;

/**
 * Patron Strategy : algorithme de mise en forme d'un document dans un format de fichier.
 * Ajouter un format = ajouter une implémentation (et sa valeur de FormatExport).
 */
public interface StrategieExport {

    /** Format produit par cette stratégie. */
    FormatExport format();

    byte[] exporter(DocumentFinancier document);
}
