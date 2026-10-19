package com.launchpad.finance.domain.strategie;

import com.launchpad.finance.domain.exception.DonneesInvalides;
import com.launchpad.finance.domain.model.HypothesesPrevisionnelles;
import org.junit.jupiter.api.Test;

import static com.launchpad.finance.domain.Fixtures.montant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CroissanceParTauxTest {

    private final CroissanceParTaux strategie = new CroissanceParTaux();

    private static HypothesesPrevisionnelles hypotheses(String tauxCa, String tauxDepenses) {
        return new HypothesesPrevisionnelles(montant("100000"), montant("70000"), montant(tauxCa), montant(tauxDepenses));
    }

    @Test
    void applique_une_croissance_composee_par_annee() {
        HypothesesPrevisionnelles h = hypotheses("10", "5");

        assertThat(strategie.projeterChiffreAffaires(h, 1)).isEqualTo(montant("110000.00"));
        assertThat(strategie.projeterChiffreAffaires(h, 3)).isEqualTo(montant("133100.00"));
        assertThat(strategie.projeterDepenses(h, 3)).isEqualTo(montant("81033.75"));
    }

    @Test
    void taux_negatif_fait_decroitre_le_montant() {
        assertThat(strategie.projeterChiffreAffaires(hypotheses("-50", "0"), 2)).isEqualTo(montant("25000.00"));
    }

    @Test
    void taux_nul_garde_le_montant_constant() {
        assertThat(strategie.projeterDepenses(hypotheses("0", "0"), 10)).isEqualTo(montant("70000.00"));
    }

    @Test
    void arrondi_unique_en_fin_de_calcul() {
        HypothesesPrevisionnelles h = new HypothesesPrevisionnelles(montant("1000"), montant("0"),
                montant("3.3"), montant("0"));
        // 1000 × 1.033^4 = 1138.678933921
        assertThat(strategie.projeterChiffreAffaires(h, 4)).isEqualTo(montant("1138.68"));
    }

    @Test
    void refuse_un_resultat_hors_capacite() {
        HypothesesPrevisionnelles h = new HypothesesPrevisionnelles(montant("9000000000000"), montant("0"),
                montant("100"), montant("0"));

        assertThatThrownBy(() -> strategie.projeterChiffreAffaires(h, 1)).isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void refuse_un_taux_inferieur_ou_egal_a_moins_100() {
        assertThatThrownBy(() -> hypotheses("-100", "0")).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> hypotheses("0", "-150")).isInstanceOf(DonneesInvalides.class);
    }
}
