package com.launchpad.document.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EmpreintePrevisionTest {

    private static String empreinte(String ca, List<ProjectionSynthese> projections) {
        return EmpreintePrevision.de("2026", new BigDecimal(ca), new BigDecimal("40000"), new BigDecimal("70000"),
                projections);
    }

    private static ProjectionSynthese annee1() {
        return new ProjectionSynthese(1, new BigDecimal("110000"), new BigDecimal("73500"), new BigDecimal("36500"));
    }

    @Test
    void memes_chiffres_meme_empreinte_quelle_que_soit_l_echelle_des_montants() {
        assertThat(empreinte("100000", List.of())).isEqualTo(empreinte("100000.00", List.of())).hasSize(64);
    }

    @Test
    void un_montant_ou_une_projection_qui_change_change_l_empreinte() {
        String base = empreinte("100000", List.of());

        assertThat(empreinte("100001", List.of())).isNotEqualTo(base);
        assertThat(empreinte("100000", List.of(annee1()))).isNotEqualTo(base);
    }

    @Test
    void la_synthese_et_la_prevision_relue_donnent_la_meme_empreinte() {
        SynthesePrevision synthese = Fixtures.synthese();

        assertThat(synthese.empreinte()).isEqualTo(EmpreintePrevision.de(synthese.periode(),
                synthese.chiffreAffaires(), synthese.coutsDirects(), synthese.depenses(), synthese.projections()));
    }
}
