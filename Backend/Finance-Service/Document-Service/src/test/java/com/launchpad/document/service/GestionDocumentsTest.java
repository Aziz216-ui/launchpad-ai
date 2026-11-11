package com.launchpad.document.service;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import com.launchpad.document.domain.SectionDocument;
import com.launchpad.document.domain.TypeDocument;
import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.domain.EtatPrevision;
import com.launchpad.document.exception.AccesRefuse;
import com.launchpad.document.exception.DocumentIntrouvable;
import com.launchpad.document.exception.DonneesInvalides;
import com.launchpad.document.service.acces.ControleAcces;
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
            new ContenuDocument("Plan de trésorerie - période 2026", List.of()), UUID.randomUUID(), "empreinte-1");

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
                stockage, analyse, evenements, sansControle(), previsions);
    }

    /** Sécurité désactivée : aucun utilisateur, tous les droits (le Prevision-Service n'est pas interrogé). */
    private static ControleAcces sansControle() {
        return new ControleAcces(projetId -> {
            throw new AssertionError("droits distants demandés sans utilisateur");
        }, Optional::empty);
    }

    /** Utilisateur connecté avec ces droits sur le projet. */
    private GestionDocuments avecDroits(boolean lecture, boolean ecriture, boolean validation) {
        ControleAcces controle = new ControleAcces(
                projetId -> new DroitsProjet(projetId, lecture, ecriture, validation),
                () -> Optional.of("conseil@launchpad.tn"));
        return new GestionDocuments(documents, new GenerateurDocsFinanciers(previsions),
                new ExporteurFinancier(List.of(strategieFactice(FormatExport.PDF))), stockage, analyse, evenements,
                controle, previsions);
    }

    @Test
    void le_financier_certifie_un_document_une_seule_fois() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));
        when(previsions.etat(document.previsionId())).thenReturn(new EtatPrevision("VALIDEE", "empreinte-1"));

        DocumentFinancier certifie = avecDroits(true, false, true).certifierDocument(document.id(), "Conforme");

        assertThat(certifie.certification().auteur()).isEqualTo("conseil@launchpad.tn");
        assertThat(certifie.certification().commentaire()).isEqualTo("Conforme");
        verify(documents).updateCertification(document.id(), certifie.certification());

        when(documents.findById(document.id())).thenReturn(Optional.of(certifie));
        assertThatThrownBy(() -> avecDroits(true, false, true).certifierDocument(document.id(), null))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void un_document_tire_d_une_prevision_non_validee_ne_se_certifie_pas() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));
        when(previsions.etat(document.previsionId())).thenReturn(new EtatPrevision("EN_ATTENTE", "empreinte-1"));

        assertThatThrownBy(() -> avecDroits(true, false, true).certifierDocument(document.id(), null))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("validée");
        verify(documents, never()).updateCertification(any(), any());
    }

    @Test
    void un_document_dont_les_chiffres_ont_change_depuis_sa_generation_ne_se_certifie_pas() {
        // Scénario : document généré, puis nouvelles projections, puis validation de la NOUVELLE version.
        when(documents.findById(document.id())).thenReturn(Optional.of(document));
        when(previsions.etat(document.previsionId())).thenReturn(new EtatPrevision("VALIDEE", "empreinte-2"));

        assertThatThrownBy(() -> avecDroits(true, false, true).certifierDocument(document.id(), null))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("a été modifiée");
        verify(documents, never()).updateCertification(any(), any());
    }

    @Test
    void un_document_ancien_sans_prevision_source_doit_etre_regenere() {
        DocumentFinancier ancien = DocumentFinancier.creer(PROJET_ID, TypeDocument.PLAN_TRESORERIE,
                new ContenuDocument("Plan de trésorerie - période 2025", List.of()));
        when(documents.findById(ancien.id())).thenReturn(Optional.of(ancien));

        assertThatThrownBy(() -> avecDroits(true, false, true).certifierDocument(ancien.id(), null))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("regénérez");
    }

    @Test
    void le_document_genere_retient_la_prevision_source() {
        UUID source = UUID.randomUUID();
        com.launchpad.document.domain.SynthesePrevision s = synthese();
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(new com.launchpad.document.domain.SynthesePrevision(
                s.periode(), s.chiffreAffaires(), s.coutsDirects(), s.depenses(), s.resultat(), s.margeBrute(),
                s.margeNette(), s.tauxMargeBrute(), s.tauxMargeNette(), s.ecartMontant(), s.ecartPourcentage(),
                s.ecartStatut(), s.projections(), source));
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentFinancier genere = gestion.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false);

        assertThat(genere.previsionId()).isEqualTo(source);
        assertThat(genere.empreintePrevision()).isEqualTo(s.empreinte()).hasSize(64);
    }

    @Test
    void le_proprietaire_ne_peut_pas_certifier_son_propre_document() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> avecDroits(true, true, false).certifierDocument(document.id(), null))
                .isInstanceOf(AccesRefuse.class);
        verify(documents, never()).updateCertification(any(), any());
    }

    @Test
    void le_financier_ne_genere_ni_ne_supprime_de_document() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));
        GestionDocuments financier = avecDroits(true, false, true);

        assertThatThrownBy(() -> financier.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null, false))
                .isInstanceOf(AccesRefuse.class);
        assertThatThrownBy(() -> financier.supprimerDocument(document.id())).isInstanceOf(AccesRefuse.class);
        verifyNoInteractions(previsions, stockage);
        verify(documents, never()).deleteById(any());
    }

    @Test
    void sans_droit_de_lecture_le_document_n_est_pas_renvoye() {
        when(documents.findById(document.id())).thenReturn(Optional.of(document));

        assertThatThrownBy(() -> avecDroits(false, false, false).consulterDocument(document.id()))
                .isInstanceOf(AccesRefuse.class);
        assertThatThrownBy(() -> avecDroits(false, false, false).listerDocuments(PROJET_ID))
                .isInstanceOf(AccesRefuse.class);
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
