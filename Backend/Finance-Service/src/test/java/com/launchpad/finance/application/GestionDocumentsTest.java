package com.launchpad.finance.application;

import com.launchpad.finance.domain.exception.DocumentIntrouvable;
import com.launchpad.finance.domain.exception.PrevisionIntrouvable;
import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.model.TypeDocument;
import com.launchpad.finance.domain.port.DocumentRepository;
import com.launchpad.finance.domain.port.PrevisionRepository;
import com.launchpad.finance.domain.service.CalculateurMarge;
import com.launchpad.finance.domain.service.ComparateurRevenusDepenses;
import com.launchpad.finance.domain.service.GenerateurDocsFinanciers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static com.launchpad.finance.domain.Fixtures.PROJET_ID;
import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GestionDocumentsTest {

    @Mock
    private PrevisionRepository previsions;

    @Mock
    private DocumentRepository documents;

    private GestionDocuments gestion;

    @BeforeEach
    void setUp() {
        gestion = new GestionDocuments(documents,
                new GenerateurDocsFinanciers(previsions, new CalculateurMarge(), new ComparateurRevenusDepenses()));
    }

    @Test
    void generer_document_calcule_le_contenu_puis_le_sauvegarde() {
        when(previsions.findLatestByProjetId(PROJET_ID)).thenReturn(Optional.of(prevision()));
        when(documents.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        DocumentFinancier document = gestion.genererDocument(PROJET_ID, TypeDocument.PLAN_TRESORERIE, montant("500"));

        assertThat(document.projetId()).isEqualTo(PROJET_ID);
        assertThat(document.type()).isEqualTo(TypeDocument.PLAN_TRESORERIE);
        assertThat(document.contenu().titre()).isEqualTo("Plan de trésorerie - période 2026");
        verify(documents).save(document);
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
}
