package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.ContenuDocument;
import com.launchpad.prevision.domain.LigneDocument;
import com.launchpad.prevision.domain.SectionDocument;
import com.launchpad.prevision.exception.IaIndisponible;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.launchpad.prevision.domain.Fixtures.montant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedacteurIATest {

    private final ClientLLM llm = mock(ClientLLM.class);
    private final RedacteurIA redacteur = new RedacteurIA(llm);

    private static ContenuDocument contenu() {
        return new ContenuDocument("Business plan", List.of(new SectionDocument("Marges",
                List.of("Montant", "Taux (%)"),
                List.of(LigneDocument.de("Marge brute", montant("60000.00"), montant("60.00"))), List.of())));
    }

    @Test
    void renvoie_les_paragraphes_rediges_a_partir_des_tableaux_calcules() {
        when(llm.generer(any(), contains("Marge brute : 60000.00 | 60.00")))
                .thenReturn("Premier paragraphe.\n\nSecond paragraphe.");

        assertThat(redacteur.analyser(contenu())).containsExactly("Premier paragraphe.", "Second paragraphe.");
    }

    @Test
    void propage_l_indisponibilite_de_l_ia() {
        when(llm.generer(any(), any())).thenThrow(new IaIndisponible("indisponible"));

        assertThatThrownBy(() -> redacteur.analyser(contenu())).isInstanceOf(IaIndisponible.class);
    }
}
