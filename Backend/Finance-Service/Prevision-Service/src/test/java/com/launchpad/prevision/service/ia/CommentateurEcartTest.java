package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.exception.IaIndisponible;
import com.launchpad.prevision.exception.PrevisionIntrouvable;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.ComparateurRevenusDepenses;
import com.launchpad.prevision.service.GestionPrevisions;
import org.junit.jupiter.api.Test;

import static com.launchpad.prevision.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CommentateurEcartTest {

    private final GestionPrevisions gestionPrevisions = mock(GestionPrevisions.class);
    private final ClientLLM llm = mock(ClientLLM.class);
    private final CommentateurEcart commentateur = new CommentateurEcart(gestionPrevisions, new CalculateurMarge(),
            new ComparateurRevenusDepenses(), llm);

    @Test
    void transmet_au_modele_les_chiffres_calcules_par_le_code() {
        PrevisionFinanciere prevision = prevision("100000", "40000", "70000");
        when(gestionPrevisions.consulterPrevision(prevision.id())).thenReturn(prevision);
        when(llm.generer(eq(CommentateurEcart.CONSIGNES), any())).thenReturn("Situation saine.");

        String commentaire = commentateur.commenter(prevision.id());

        assertThat(commentaire).isEqualTo("Situation saine.");
        org.mockito.Mockito.verify(llm).generer(eq(CommentateurEcart.CONSIGNES),
                org.mockito.ArgumentMatchers.argThat(chiffres -> chiffres.contains("Chiffre d'affaires : 100000")
                        && chiffres.contains("Dépenses totales : 70000")
                        && chiffres.contains("statut EXCEDENT")));
    }

    @Test
    void prevision_inconnue_n_appelle_pas_le_modele() {
        PrevisionFinanciere prevision = prevision();
        when(gestionPrevisions.consulterPrevision(prevision.id())).thenThrow(new PrevisionIntrouvable(prevision.id()));

        assertThatThrownBy(() -> commentateur.commenter(prevision.id())).isInstanceOf(PrevisionIntrouvable.class);
        verifyNoInteractions(llm);
    }

    @Test
    void propage_l_indisponibilite_de_l_ia() {
        PrevisionFinanciere prevision = prevision();
        when(gestionPrevisions.consulterPrevision(prevision.id())).thenReturn(prevision);
        when(llm.generer(any(), any())).thenThrow(new IaIndisponible("indisponible"));

        assertThatThrownBy(() -> commentateur.commenter(prevision.id())).isInstanceOf(IaIndisponible.class);
    }
}
