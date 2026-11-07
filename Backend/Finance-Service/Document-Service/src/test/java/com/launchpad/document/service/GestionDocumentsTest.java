package com.launchpad.document.service;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import com.launchpad.document.domain.SectionDocument;
import com.launchpad.document.domain.TypeDocument;
import com.launchpad.document.exception.DocumentIntrouvable;
import com.launchpad.document.exception.IaIndisponible;
import com.launchpad.document.exception.PrevisionIntrouvable;
import com.launchpad.document.repository.DocumentRepository;
import com.launchpad.document.service.export.ExporteurFinancier;
import com.launchpad.document.service.export.StrategieExport;
import com.launchpad.document.service.stockage.StockageDocuments;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static com.launchpad.document.domain.Fixtures.montant;
import static com.launchpad.document.domain.Fixtures.synthese;
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
    private PrevisionDistante previsions;

    @Mock
    private DocumentRepository documents;

    @Mock
    private StockageDocuments stockage;
    @Mock
    private AnalyseDistante analyse;
    @Mock
    private ApplicationEventPublisher evenements;

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
                new GenerateurDocsFinanciers(previsions),
                new ExporteurFinancier(List.of(strategieFactice(FormatExport.PDF), strategieFactice(FormatExport.EXCEL))),
                stockage, analyse, evenements);
    }

    @Test
    void generer_document_calcule_le_contenu_puis_le_sauvegarde() {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(synthese());
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentFinancier genere = gestion.genererDocument(PROJET_ID, TypeDocument.PLAN_TRESORERIE, montant("500"),
                false);

        assertThat(genere.projetId()).isEqualTo(PROJET_ID);
        assertThat(genere.type()).isEqualTo(TypeDocument.PLAN_TRESORERIE);
        assertThat(genere.contenu().titre()).isEqualTo("Plan de trésorerie - période 2026");
        verify(documents).save(genere);
    }

    @Test
    void avec_analyse_le_document_sauvegarde_est_enrichi_par_l_ia() {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(synthese());
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(analyse.analyser(any())).thenReturn(List.of("Premier.", "Second."));

        DocumentFinancier genere = gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, true);

        assertThat(genere.contenu().sections()).hasSize(5);
        SectionDocument sectionAnalyse = genere.contenu().sections().get(4);
        assertThat(sectionAnalyse.titre()).isEqualTo(ContenuDocument.TITRE_SECTION_ANALYSE);
        assertThat(sectionAnalyse.notes()).containsExactly("Premier.", "Second.");
        verify(documents).save(genere);
    }

    @Test
    void generer_document_publie_un_evenement_document_genere() {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(synthese());
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentFinancier genere = gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false);

        verify(evenements).publishEvent(DocumentGenere.de(genere));
    }

    @Test
    void aucun_evenement_si_la_generation_echoue() {
        when(previsions.derniereSynthese(PROJET_ID)).thenThrow(PrevisionIntrouvable.pourProjet(PROJET_ID));

        assertThatThrownBy(() -> gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false))
                .isInstanceOf(PrevisionIntrouvable.class);
        verifyNoInteractions(evenements);
    }

    @Test
    void sans_analyse_l_ia_n_est_pas_appelee() {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(synthese());
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false);

        verifyNoInteractions(analyse);
    }

    @Test
    void ia_indisponible_ne_sauvegarde_aucun_document() {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(synthese());
        when(analyse.analyser(any())).thenThrow(new IaIndisponible("indisponible"));

        assertThatThrownBy(() -> gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, true))
                .isInstanceOf(IaIndisponible.class);
        verify(documents, never()).save(any());
    }

    @Test
    void generer_document_sans_prevision_ne_sauvegarde_rien() {
        when(previsions.derniereSynthese(PROJET_ID)).thenThrow(PrevisionIntrouvable.pourProjet(PROJET_ID));

        assertThatThrownBy(() -> gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false))
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
