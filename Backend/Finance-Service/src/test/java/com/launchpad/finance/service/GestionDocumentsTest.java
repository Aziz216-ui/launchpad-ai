package com.launchpad.finance.service;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FichierExporte;
import com.launchpad.finance.domain.FormatExport;
import com.launchpad.finance.domain.TypeDocument;
import com.launchpad.finance.exception.DocumentIntrouvable;
import com.launchpad.finance.exception.PrevisionIntrouvable;
import com.launchpad.finance.repository.DocumentRepository;
import com.launchpad.finance.repository.PrevisionRepository;
import com.launchpad.finance.service.export.ExporteurFinancier;
import com.launchpad.finance.service.export.StrategieExport;
import com.launchpad.finance.service.stockage.StockageDocuments;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.launchpad.finance.domain.Fixtures.PROJET_ID;
import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GestionDocumentsTest {

    @Mock
    private PrevisionRepository previsions;

    @Mock
    private DocumentRepository documents;

    @Mock
    private StockageDocuments stockage;

    private GestionDocuments gestion;

    private final DocumentFinancier document = DocumentFinancier.creer(PROJET_ID, TypeDocument.PLAN_TRESORERIE,
            new ContenuDocument("Plan de trésorerie - période 2026", List.of()));

    /** Stratégie d'export factice : renvoie le nom du format en octets. */
    private static StrategieExport strategieFactice(FormatExport format) {
        return new StrategieExport() {
            @Override
            public FormatExport format() {
                return format;
            }

            @Override
            public byte[] exporter(DocumentFinancier doc) {
                return format.name().getBytes();
            }
        };
    }

    @BeforeEach
    void setUp() {
        gestion = new GestionDocuments(documents,
                new GenerateurDocsFinanciers(previsions, new CalculateurMarge(), new ComparateurRevenusDepenses()),
                new ExporteurFinancier(List.of(strategieFactice(FormatExport.PDF), strategieFactice(FormatExport.EXCEL))),
                stockage);
    }

    @Test
    void generer_document_calcule_le_contenu_puis_le_sauvegarde() {
        when(previsions.findLatestByProjetId(PROJET_ID)).thenReturn(Optional.of(prevision()));
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentFinancier genere = gestion.genererDocument(PROJET_ID, TypeDocument.PLAN_TRESORERIE, montant("500"));

        assertThat(genere.projetId()).isEqualTo(PROJET_ID);
        assertThat(genere.type()).isEqualTo(TypeDocument.PLAN_TRESORERIE);
        assertThat(genere.contenu().titre()).isEqualTo("Plan de trésorerie - période 2026");
        verify(documents).save(genere);
    }

    @Test
    void generer_document_sans_prevision_ne_sauvegarde_rien() {
        when(previsions.findLatestByProjetId(PROJET_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null))
                .isInstanceOf(PrevisionIntrouvable.class);
        verify(documents, never()).save(any());
    }

    @Test
    void consulter_un_document_inconnu_leve_document_introuvable() {
        UUID id = UUID.randomUUID();
        when(documents.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gestion.consulterDocument(id)).isInstanceOf(DocumentIntrouvable.class);
    }

    @Test
    void exporter_choisit_la_strategie_du_format_et_stocke_le_fichier() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));

        FichierExporte fichier = gestion.exporterDocument(document.id(), FormatExport.EXCEL);

        assertThat(fichier.contenu()).isEqualTo("EXCEL".getBytes());
        assertThat(fichier.nomFichier()).isEqualTo("plan-tresorerie-" + document.id() + ".xlsx");
        assertThat(fichier.typeContenu()).isEqualTo(FormatExport.EXCEL.typeContenu());
        verify(stockage).enregistrer(document.id() + ".xlsx", "EXCEL".getBytes(), FormatExport.EXCEL.typeContenu());
    }

    @Test
    void supprimer_efface_les_fichiers_de_tous_les_formats_puis_l_enregistrement() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));

        gestion.supprimerDocument(document.id());

        InOrder ordre = inOrder(stockage, documents);
        ordre.verify(stockage).supprimer(document.id() + ".pdf");
        ordre.verify(stockage).supprimer(document.id() + ".xlsx");
        ordre.verify(documents).deleteById(document.id());
    }

    @Test
    void supprimer_un_document_inconnu_ne_touche_a_rien() {
        UUID id = UUID.randomUUID();
        when(documents.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gestion.supprimerDocument(id)).isInstanceOf(DocumentIntrouvable.class);
        verifyNoInteractions(stockage);
        verify(documents, never()).deleteById(any());
    }
}
