package com.launchpad.document.service.export;

import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Exporteur financier (contexte du patron Strategy) : délègue à la StrategieExport du format demandé.
 */
@Service
public class ExporteurFinancier {

    private final Map<FormatExport, StrategieExport> strategies = new EnumMap<>(FormatExport.class);

    public ExporteurFinancier(List<StrategieExport> strategiesDisponibles) {
        for (StrategieExport strategie : strategiesDisponibles) {
            if (strategies.put(strategie.format(), strategie) != null) {
                throw new IllegalStateException("Deux stratégies d'export pour le format " + strategie.format());
            }
        }
    }

    public FichierExporte exporterPDF(DocumentFinancier document) {
        return exporter(document, FormatExport.PDF);
    }

    public FichierExporte exporterExcel(DocumentFinancier document) {
        return exporter(document, FormatExport.EXCEL);
    }

    public FichierExporte exporter(DocumentFinancier document, FormatExport format) {
        StrategieExport strategie = strategies.get(format);
        if (strategie == null) {
            throw new IllegalStateException("Aucune stratégie d'export pour le format " + format);
        }
        return new FichierExporte(nomFichier(document, format), format.typeContenu(), strategie.exporter(document));
    }

    /** Ex. « plan-tresorerie-3f2a….pdf ». */
    private static String nomFichier(DocumentFinancier document, FormatExport format) {
        return document.type().name().toLowerCase(Locale.ROOT).replace('_', '-') + "-" + document.id()
                + "." + format.extension();
    }
}
