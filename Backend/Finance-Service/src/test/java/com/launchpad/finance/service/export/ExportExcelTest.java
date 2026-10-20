package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.FormatExport;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;

class ExportExcelTest {

    private final ExportExcel export = new ExportExcel();

    private static Row ligne(Sheet feuille, String libelle) {
        return StreamSupport.stream(feuille.spliterator(), false)
                .filter(r -> r.getCell(0) != null && libelle.equals(r.getCell(0).getStringCellValue()))
                .findFirst().orElseThrow(() -> new AssertionError("Ligne absente : " + libelle));
    }

    @Test
    void produit_un_classeur_avec_montants_numeriques_formates() throws IOException {
        byte[] xlsx = export.exporter(ExportTestFixtures.document());

        try (Workbook classeur = new XSSFWorkbook(new ByteArrayInputStream(xlsx))) {
            Sheet feuille = classeur.getSheet("Document");
            assertThat(feuille.getRow(0).getCell(0).getStringCellValue()).isEqualTo("Business plan - période 2026");

            Row margeBrute = ligne(feuille, "Marge brute");
            Cell montant = margeBrute.getCell(1);
            assertThat(montant.getCellType()).isEqualTo(CellType.NUMERIC);
            assertThat(montant.getNumericCellValue()).isEqualTo(60000.00);
            assertThat(montant.getCellStyle().getDataFormatString()).isEqualTo("#,##0.00");
            assertThat(margeBrute.getCell(2).getNumericCellValue()).isEqualTo(60.00);
            assertThat(ligne(feuille, "Marge nette").getCell(1).getNumericCellValue()).isEqualTo(-1234567.89);

            assertThat(ligne(feuille, "Statut : EXCEDENT")).isNotNull();
            assertThat(ligne(feuille, "Projections pluriannuelles")).isNotNull();
            assertThat(ligne(feuille, "Aucune projection pluriannuelle n'a été générée pour cette prévision."))
                    .isNotNull();
        }
    }

    @Test
    void annonce_le_format_excel() {
        assertThat(export.format()).isEqualTo(FormatExport.EXCEL);
    }
}
