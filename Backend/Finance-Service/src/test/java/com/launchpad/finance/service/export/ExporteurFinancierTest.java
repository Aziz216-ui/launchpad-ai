package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.FichierExporte;
import com.launchpad.finance.domain.FormatExport;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExporteurFinancierTest {

    private final ExporteurFinancier exporteur = new ExporteurFinancier(List.of(new ExportPdf(), new ExportExcel()));

    @Test
    void exporter_pdf_delegue_a_la_strategie_pdf() {
        FichierExporte fichier = exporteur.exporterPDF(ExportTestFixtures.document());

        assertThat(fichier.nomFichier()).isEqualTo("business-plan-" + ExportTestFixtures.DOCUMENT_ID + ".pdf");
        assertThat(fichier.typeContenu()).isEqualTo("application/pdf");
        assertThat(new String(fichier.contenu(), 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
    }

    @Test
    void exporter_excel_delegue_a_la_strategie_excel() {
        FichierExporte fichier = exporteur.exporterExcel(ExportTestFixtures.document());

        assertThat(fichier.nomFichier()).endsWith(".xlsx");
        assertThat(fichier.typeContenu()).isEqualTo(FormatExport.EXCEL.typeContenu());
        // Un .xlsx est une archive ZIP : signature « PK ».
        assertThat(new String(fichier.contenu(), 0, 2, StandardCharsets.US_ASCII)).isEqualTo("PK");
    }

    @Test
    void format_sans_strategie_ou_strategies_en_double_refuses() {
        ExporteurFinancier pdfSeulement = new ExporteurFinancier(List.of(new ExportPdf()));

        assertThatThrownBy(() -> pdfSeulement.exporterExcel(ExportTestFixtures.document()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new ExporteurFinancier(List.of(new ExportPdf(), new ExportPdf())))
                .isInstanceOf(IllegalStateException.class);
    }
}
