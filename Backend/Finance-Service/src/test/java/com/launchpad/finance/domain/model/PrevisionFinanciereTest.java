package com.launchpad.finance.domain.model;

import com.launchpad.finance.domain.exception.DonneesInvalides;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static com.launchpad.finance.domain.Fixtures.PROJET_ID;
import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PrevisionFinanciereTest {

    @Test
    void creer_genere_un_identifiant_et_arrondit_a_deux_decimales() {
        PrevisionFinanciere p = PrevisionFinanciere.creer(PROJET_ID, " 2026 ", montant("1000.005"),
                montant("100"), montant("200.1"));

        assertThat(p.id()).isNotNull();
        assertThat(p.periode()).isEqualTo("2026");
        assertThat(p.chiffreAffaires()).isEqualByComparingTo("1000.01").hasScaleOf(2);
        assertThat(p.depenses()).isEqualTo(montant("200.10"));
        assertThat(p.projections()).isEmpty();
    }

    @Test
    void resultat_egal_ca_moins_depenses() {
        assertThat(prevision().calculerResultat()).isEqualTo(montant("30000.00"));
        assertThat(prevision("1000", "500", "1500").calculerResultat()).isEqualTo(montant("-500.00"));
    }

    @Test
    void refuse_des_couts_directs_superieurs_aux_depenses() {
        assertThatThrownBy(() -> prevision("1000", "800", "500"))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("coutsDirects");
    }

    @Test
    void refuse_les_montants_negatifs_ou_absents() {
        assertThatThrownBy(() -> prevision("-1", "0", "0")).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> PrevisionFinanciere.creer(PROJET_ID, "2026", null, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("chiffreAffaires");
    }

    @Test
    void refuse_un_montant_hors_capacite_numeric_15_2() {
        assertThatThrownBy(() -> prevision("10000000000000", "0", "0"))
                .isInstanceOf(DonneesInvalides.class)
                .hasMessageContaining("maximal");
    }

    @Test
    void refuse_projet_ou_periode_manquants() {
        assertThatThrownBy(() -> PrevisionFinanciere.creer(null, "2026", BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE))
                .isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> PrevisionFinanciere.creer(PROJET_ID, "  ", BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE))
                .isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> PrevisionFinanciere.creer(PROJET_ID, "x".repeat(51), BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void avec_projections_conserve_l_identite_et_rend_une_liste_immuable() {
        PrevisionFinanciere p = prevision();
        PrevisionFinanciere avec = p.avecProjections(List.of(ProjectionFinanciere.de(1, montant("10"), montant("4"))));

        assertThat(avec.id()).isEqualTo(p.id());
        assertThat(avec.projections()).singleElement()
                .satisfies(proj -> assertThat(proj.marge()).isEqualTo(montant("6.00")));
        assertThatThrownBy(() -> avec.projections().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void projection_refuse_une_annee_inferieure_a_un() {
        assertThatThrownBy(() -> ProjectionFinanciere.de(0, BigDecimal.ONE, BigDecimal.ONE))
                .isInstanceOf(DonneesInvalides.class);
    }
}
