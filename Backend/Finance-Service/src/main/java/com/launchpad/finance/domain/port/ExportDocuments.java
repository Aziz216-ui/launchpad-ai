package com.launchpad.finance.domain.port;

import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.model.FichierExporte;
import com.launchpad.finance.domain.model.FormatExport;

/**
 * Port d'export d'un document dans un format de fichier (implémenté par ExporteurFinancier).
 */
public interface ExportDocuments {

    FichierExporte exporter(DocumentFinancier document, FormatExport format);
}
