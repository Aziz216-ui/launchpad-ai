package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.FormatExport;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class ExportPdfTest {

    private final ExportPdf export = new ExportPdf();

    @Test
    void produit_un_pdf_lisible_avec_titre_tableaux_et_notes() throws IOException {
        byte[] pdf = export.exporter(ExportTestFixtures.document());

        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        PdfReader lecteur = new PdfReader(pdf);
        try {
            String texte = new PdfTextExtractor(lecteur).getTextFromPage(1);
            assertThat(texte)
                    .contains("Business plan - période 2026")
                    .contains("Marge brute").contains("60 000,00").contains("60,00")
                    .contains("-1 234 567,89")
                    .contains("Statut : EXCEDENT")
                    .contains("Aucune projection pluriannuelle")
                    .contains("01/03/2026 10:15 UTC");
        } finally {
            lecteur.close();
        }
    }

    @Test
    void annonce_le_format_pdf() {
        assertThat(export.format()).isEqualTo(FormatExport.PDF);
    }
}
