package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FormatExport;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.SectionDocument;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Stratégie d'export Excel (Apache POI) : une feuille, les sections les unes sous les autres,
 * montants en cellules numériques (format « # ##0,00 »).
 */
@Component
public class ExportExcel implements StrategieExport {

    private static final int LARGEUR_LIBELLE = 45 * 256;
    private static final int LARGEUR_VALEUR = 20 * 256;

    @Override
    public FormatExport format() {
        return FormatExport.EXCEL;
    }

    @Override
    public byte[] exporter(DocumentFinancier document) {
        try (Workbook classeur = new XSSFWorkbook(); ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {
            Styles styles = new Styles(classeur);
            Sheet feuille = classeur.createSheet("Document");
            int ligne = 0;
            texte(feuille.createRow(ligne++), 0, document.contenu().titre(), styles.titre);
            texte(feuille.createRow(ligne++), 0, "Projet " + document.projetId() + " - généré le "
                    + FormatMontant.DATE.format(document.creeLe()), null);
            int colonnesMax = 1;
            for (SectionDocument section : document.contenu().sections()) {
                ligne++;
                ligne = ecrireSection(feuille, ligne, section, styles);
                colonnesMax = Math.max(colonnesMax, section.colonnes().size());
            }
            feuille.setColumnWidth(0, LARGEUR_LIBELLE);
            for (int colonne = 1; colonne <= colonnesMax; colonne++) {
                feuille.setColumnWidth(colonne, LARGEUR_VALEUR);
            }
            classeur.write(sortie);
            return sortie.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de la génération Excel du document " + document.id(), e);
        }
    }

    private static int ecrireSection(Sheet feuille, int ligne, SectionDocument section, Styles styles) {
        texte(feuille.createRow(ligne++), 0, section.titre(), styles.section);
        if (!section.lignes().isEmpty()) {
            Row entete = feuille.createRow(ligne++);
            texte(entete, 0, "", styles.entete);
            List<String> colonnes = section.colonnes();
            for (int i = 0; i < colonnes.size(); i++) {
                texte(entete, i + 1, colonnes.get(i), styles.entete);
            }
            for (LigneDocument donnees : section.lignes()) {
                Row row = feuille.createRow(ligne++);
                texte(row, 0, donnees.libelle(), null);
                for (int i = 0; i < donnees.valeurs().size(); i++) {
                    var cellule = row.createCell(i + 1);
                    cellule.setCellValue(donnees.valeurs().get(i).doubleValue());
                    cellule.setCellStyle(styles.montant);
                }
            }
        }
        for (String note : section.notes()) {
            texte(feuille.createRow(ligne++), 0, note, styles.note);
        }
        return ligne;
    }

    private static void texte(Row row, int colonne, String valeur, CellStyle style) {
        var cellule = row.createCell(colonne);
        cellule.setCellValue(valeur);
        if (style != null) {
            cellule.setCellStyle(style);
        }
    }

    /** Styles créés une fois par classeur (POI limite leur nombre). */
    private static final class Styles {
        final CellStyle titre;
        final CellStyle section;
        final CellStyle entete;
        final CellStyle montant;
        final CellStyle note;

        Styles(Workbook classeur) {
            titre = style(classeur, police(classeur, true, false, (short) 14));
            section = style(classeur, police(classeur, true, false, (short) 12));
            entete = style(classeur, police(classeur, true, false, (short) 10));
            note = style(classeur, police(classeur, false, true, (short) 10));
            montant = classeur.createCellStyle();
            montant.setDataFormat(classeur.createDataFormat().getFormat("#,##0.00"));
        }

        private static Font police(Workbook classeur, boolean gras, boolean italique, short taille) {
            Font police = classeur.createFont();
            police.setBold(gras);
            police.setItalic(italique);
            police.setFontHeightInPoints(taille);
            return police;
        }

        private static CellStyle style(Workbook classeur, Font police) {
            CellStyle style = classeur.createCellStyle();
            style.setFont(police);
            return style;
        }
    }
}
