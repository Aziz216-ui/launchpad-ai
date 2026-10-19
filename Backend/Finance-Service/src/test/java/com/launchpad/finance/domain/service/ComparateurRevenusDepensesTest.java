package com.launchpad.finance.domain.service;

import com.launchpad.finance.domain.model.EcartFinancier;
import com.launchpad.finance.domain.model.StatutEcart;
import org.junit.jupiter.api.Test;

import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;

class ComparateurRevenusDepensesTest {

    private final ComparateurRevenusDepenses comparateur = new ComparateurRevenusDepenses();

    @Test
    void excedent_quand_le_ca_depasse_les_depenses() {
        assertThat(comparateur.comparer(prevision()))
                .isEqualTo(new EcartFinancier(montant("30000.00"), montant("30.00"), StatutEcart.EXCEDENT));
    }

    @Test
    void equilibre_quand_ca_et_depenses_sont_egaux() {
        assertThat(comparateur.comparer(prevision("5000", "1000", "5000")))
                .isEqualTo(new EcartFinancier(montant("0.00"), montant("0.00"), StatutEcart.EQUILIBRE));
    }

    @Test
    void deficit_quand_les_depenses_depassent_le_ca() {
        assertThat(comparateur.comparer(prevision("8000", "1000", "10000")))
                .isEqualTo(new EcartFinancier(montant("-2000.00"), montant("-25.00"), StatutEcart.DEFICIT));
    }

    @Test
    void pourcentage_nul_si_le_ca_est_nul() {
        EcartFinancier ecart = comparateur.comparer(prevision("0", "0", "1200"));

        assertThat(ecart.montant()).isEqualTo(montant("-1200.00"));
        assertThat(ecart.pourcentage()).isEqualTo(montant("0.00"));
        assertThat(ecart.statut()).isEqualTo(StatutEcart.DEFICIT);
    }
}
