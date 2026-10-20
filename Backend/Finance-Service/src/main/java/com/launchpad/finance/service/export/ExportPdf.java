package com.launchpad.finance.service.export;

import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FormatExport;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.SectionDocument;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;

/**
 * Stratégie d'export PDF (OpenPDF) : titre, puis un tableau et ses notes par section.
 */
@Component
public class ExportPdf implements StrategieExport {

    private static final Font TITRE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
    private static final Font SOUS_TITRE = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
    private static final Font SECTION = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12);
    private static final Font ENTETE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9);
    private static final Font CELLULE = FontFactory.getFont(FontFactory.HELVETICA, 9);
    private static final Font NOTE = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 9);
    private static final Color FOND_ENTETE = new Color(230, 236, 245);

    @Override
    public FormatExport format() {
        return FormatExport.PDF;
    }

    @Override
    public byte[] exporter(DocumentFinancier document) {
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        Document pdf = new Document(PageSize.A4, 40, 40, 40, 40);
        try {
            PdfWriter.getInstance(pdf, sortie);
            pdf.addTitle(document.contenu().titre());
            pdf.open();
            pdf.add(new Paragraph(document.contenu().titre(), TITRE));
            pdf.add(new Paragraph("Projet " + document.projetId() + " - généré le "
                    + FormatMontant.DATE.format(document.creeLe()), SOUS_TITRE));
            for (SectionDocument section : document.contenu().sections()) {
                ajouterSection(pdf, section);
            }
        } catch (DocumentException e) {
            throw new IllegalStateException("Échec de la génération du PDF du document " + document.id(), e);
        } finally {
            pdf.close();
        }
        return sortie.toByteArray();
    }

    private static void ajouterSection(Document pdf, SectionDocument section) {
        Paragraph titre = new Paragraph(section.titre(), SECTION);
        titre.setSpacingBefore(14);
        titre.setSpacingAfter(6);
        pdf.add(titre);
        if (!section.lignes().isEmpty()) {
            pdf.add(tableau(section));
        }
        for (String note : section.notes()) {
            Paragraph paragraphe = new Paragraph(note, NOTE);
            paragraphe.setSpacingBefore(4);
            pdf.add(paragraphe);
        }
    }

    private static PdfPTable tableau(SectionDocument section) {
        PdfPTable tableau = new PdfPTable(section.colonnes().size() + 1);
        tableau.setWidthPercentage(100);
        tableau.addCell(cellule("", ENTETE, Element.ALIGN_LEFT, FOND_ENTETE));
        for (String colonne : section.colonnes()) {
            tableau.addCell(cellule(colonne, ENTETE, Element.ALIGN_RIGHT, FOND_ENTETE));
        }
        for (LigneDocument ligne : section.lignes()) {
            tableau.addCell(cellule(ligne.libelle(), CELLULE, Element.ALIGN_LEFT, null));
            for (BigDecimal valeur : ligne.valeurs()) {
                tableau.addCell(cellule(FormatMontant.formater(valeur), CELLULE, Element.ALIGN_RIGHT, null));
            }
        }
        return tableau;
    }

    private static PdfPCell cellule(String texte, Font police, int alignement, Color fond) {
        PdfPCell cellule = new PdfPCell(new Phrase(texte, police));
        cellule.setHorizontalAlignment(alignement);
        cellule.setPadding(4);
        if (fond != null) {
            cellule.setBackgroundColor(fond);
        }
        return cellule;
    }
}
