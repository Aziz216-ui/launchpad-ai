package com.launchpad.finance.domain.service;

import com.launchpad.finance.domain.model.Marges;
import org.junit.jupiter.api.Test;

import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;

class CalculateurMargeTest {

    private final CalculateurMarge calculateur = new CalculateurMarge();

    @Test
    void marge_brute_egale_ca_moins_couts_directs() {
        assertThat(calculateur.calculerMargeBrute(montant("100000"), montant("40000"))).isEqualTo(montant("60000.00"));
    }

    @Test
    void marge_nette_egale_ca_moins_depenses() {
        assertThat(calculateur.calculerMargeNette(prevision())).isEqualTo(montant("30000.00"));
    }

    @Test
    void taux_de_marge_en_pourcentage_arrondi_half_up() {
        assertThat(calculateur.calculerTauxMarge(montant("60000"), montant("100000"))).isEqualTo(montant("60.00"));
        assertThat(calculateur.calculerTauxMarge(montant("1"), montant("3"))).isEqualTo(montant("33.33"));
        assertThat(calculateur.calculerTauxMarge(montant("2"), montant("3"))).isEqualTo(montant("66.67"));
    }

    @Test
    void taux_de_marge_vaut_zero_si_le_ca_est_nul() {
        assertThat(calculateur.calculerTauxMarge(montant("-500"), montant("0"))).isEqualTo(montant("0.00"));
    }

    @Test
    void calculer_marges_regroupe_marges_et_taux() {
        Marges marges = calculateur.calculerMarges(prevision());

        assertThat(marges).isEqualTo(new Marges(montant("60000.00"), montant("30000.00"),
                montant("60.00"), montant("30.00")));
    }

    @Test
    void marges_negatives_en_cas_de_perte() {
        Marges marges = calculateur.calculerMarges(prevision("1000", "1200", "1500"));

        assertThat(marges.margeBrute()).isEqualTo(montant("-200.00"));
        assertThat(marges.margeNette()).isEqualTo(montant("-500.00"));
        assertThat(marges.tauxMargeNette()).isEqualTo(montant("-50.00"));
    }
}
