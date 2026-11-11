package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ServiceIndisponible;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.DocumentDistant;
import com.launchpad.prevision.service.GestionPrevisions;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.launchpad.prevision.domain.Fixtures.PROJET_ID;
import static com.launchpad.prevision.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class OutilsFinanciersTest {

    private final GestionPrevisions gestionPrevisions = mock(GestionPrevisions.class);
    private final DocumentDistant documents = mock(DocumentDistant.class);
    private final OutilsFinanciers outils = new OutilsFinanciers(PROJET_ID, gestionPrevisions, new CalculateurMarge(),
            documents);

    @Test
    void calcule_les_marges_de_la_periode_demandee() {
        PrevisionFinanciere p = prevision("100000", "40000", "70000");
        when(gestionPrevisions.listerPrevisions(PROJET_ID)).thenReturn(List.of(p));

        String resultat = outils.calculerMarges("2026");

        assertThat(resultat).contains("Période 2026").contains("marge brute 60000").contains("marge nette 30000");
    }

    @Test
    void sans_periode_prend_la_prevision_la_plus_recente() {
        PrevisionFinanciere ancienne = new PrevisionFinanciere(UUID.randomUUID(), PROJET_ID, "2025",
                new BigDecimal("1000"), new BigDecimal("100"), new BigDecimal("200"),
                Instant.parse("2025-01-01T00:00:00Z"), List.of());
        PrevisionFinanciere recente = prevision();
        when(gestionPrevisions.listerPrevisions(PROJET_ID)).thenReturn(List.of(ancienne, recente));

        assertThat(outils.calculerMarges(null)).contains("Période 2026");
    }

    @Test
    void periode_inconnue_est_signalee_au_modele() {
        when(gestionPrevisions.listerPrevisions(PROJET_ID)).thenReturn(List.of(prevision()));

        assertThat(outils.calculerMarges("1999")).contains("Aucune prévision").contains("1999");
    }

    @Test
    void genere_un_document_pour_le_projet_via_le_document_service() {
        UUID documentId = UUID.randomUUID();
        when(documents.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN)).thenReturn(documentId);

        assertThat(outils.genererDocument("business_plan")).contains(documentId.toString());
    }

    @Test
    void type_inconnu_n_appelle_pas_la_generation() {
        assertThat(outils.genererDocument("N_IMPORTE_QUOI")).contains("Type de document inconnu");
        verifyNoInteractions(documents);
    }

    @Test
    void erreur_metier_est_renvoyee_au_modele_sous_forme_de_texte() {
        when(documents.genererDocument(PROJET_ID, TypeDocument.PLAN_TRESORERIE))
                .thenThrow(new ServiceIndisponible("Document-Service indisponible"));

        assertThat(outils.genererDocument("PLAN_TRESORERIE")).startsWith("Erreur :");
    }

    @Test
    void l_assistant_lie_les_outils_au_projet_de_la_requete_et_valide_le_message() {
        ClientLLM llm = mock(ClientLLM.class);
        when(llm.converser(org.mockito.ArgumentMatchers.eq(AssistantFinancier.CONSIGNES),
                org.mockito.ArgumentMatchers.eq("Quelle est ma marge ?"), org.mockito.ArgumentMatchers.any(Object[].class)))
                .thenReturn("Votre marge est de 60 %.");
        AssistantFinancier assistant = new AssistantFinancier(llm, gestionPrevisions, new CalculateurMarge(),
                documents, com.launchpad.prevision.service.acces.AccesFixtures.sansControle());

        assertThat(assistant.repondre(PROJET_ID, "Quelle est ma marge ?")).isEqualTo("Votre marge est de 60 %.");
        verify(llm).converser(org.mockito.ArgumentMatchers.eq(AssistantFinancier.CONSIGNES),
                org.mockito.ArgumentMatchers.eq("Quelle est ma marge ?"),
                org.mockito.ArgumentMatchers.any(OutilsFinanciers.class));
        assertThatThrownBy(() -> assistant.repondre(PROJET_ID, "  "))
                .isInstanceOf(com.launchpad.prevision.exception.DonneesInvalides.class);
        assertThatThrownBy(() -> assistant.repondre(PROJET_ID, "x".repeat(AssistantFinancier.MESSAGE_LONGUEUR_MAX + 1)))
                .isInstanceOf(com.launchpad.prevision.exception.DonneesInvalides.class);
    }
}
