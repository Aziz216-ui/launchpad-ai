package com.launchpad.finance.service;

import com.launchpad.finance.exception.DonneesInvalides;
import com.launchpad.finance.domain.HypothesesPrevisionnelles;
import com.launchpad.finance.domain.ProjectionFinanciere;
import com.launchpad.finance.service.strategie.CroissanceParTaux;
import com.launchpad.finance.service.strategie.StrategieProjection;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ModelePrevisionnelTest {

    private final ModelePrevisionnel modele = new ModelePrevisionnel(new CroissanceParTaux());
    private final HypothesesPrevisionnelles hypotheses =
            HypothesesPrevisionnelles.depuis(prevision(), montant("10"), montant("5"));

    @Test
    void genere_une_projection_par_annee_de_l_horizon() {
        List<ProjectionFinanciere> projections = modele.genererProjections(hypotheses, 3);

        assertThat(projections).containsExactly(
                new ProjectionFinanciere(1, montant("110000.00"), montant("73500.00"), montant("36500.00")),
                new ProjectionFinanciere(2, montant("121000.00"), montant("77175.00"), montant("43825.00")),
                new ProjectionFinanciere(3, montant("133100.00"), montant("81033.75"), montant("52066.25")));
    }

    @Test
    void estimations_unitaires_deleguees_a_la_strategie() {
        assertThat(modele.estimerChiffreAffaires(hypotheses, 1)).isEqualTo(montant("110000.00"));
        assertThat(modele.estimerDepensesPrevisionnelles(hypotheses, 1)).isEqualTo(montant("73500.00"));
    }

    @Test
    void horizon_borne_entre_1_et_10() {
        assertThat(modele.genererProjections(hypotheses, 1)).hasSize(1);
        assertThat(modele.genererProjections(hypotheses, 10)).hasSize(10);
        assertThatThrownBy(() -> modele.genererProjections(hypotheses, 0)).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> modele.genererProjections(hypotheses, 11)).isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void une_autre_strategie_s_ajoute_sans_modifier_le_modele() {
        StrategieProjection stable = new StrategieProjection() {
            @Override
            public BigDecimal projeterChiffreAffaires(HypothesesPrevisionnelles h, int annee) {
                return h.chiffreAffairesBase();
            }

            @Override
            public BigDecimal projeterDepenses(HypothesesPrevisionnelles h, int annee) {
                return h.depensesBase();
            }
        };

        List<ProjectionFinanciere> projections = new ModelePrevisionnel(stable).genererProjections(hypotheses, 2);

        assertThat(projections).extracting(ProjectionFinanciere::marge)
                .containsExactly(montant("30000.00"), montant("30000.00"));
    }
}
