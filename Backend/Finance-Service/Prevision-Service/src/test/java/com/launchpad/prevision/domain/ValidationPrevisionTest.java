package com.launchpad.prevision.domain;

import com.launchpad.prevision.exception.DonneesInvalides;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ValidationPrevisionTest {

    private final Instant maintenant = Instant.now();

    @Test
    void une_nouvelle_prevision_est_en_attente() {
        assertThat(Fixtures.prevision().validation()).isEqualTo(ValidationPrevision.EN_ATTENTE);
    }

    @Test
    void une_validation_peut_se_passer_de_commentaire() {
        ValidationPrevision v = ValidationPrevision.avis(StatutValidation.VALIDEE, "  ", "conseil@x.tn", maintenant);

        assertThat(v.statut()).isEqualTo(StatutValidation.VALIDEE);
        assertThat(v.commentaire()).isNull();
    }

    @Test
    void un_rejet_doit_etre_motive() {
        assertThatThrownBy(() -> ValidationPrevision.avis(StatutValidation.REJETEE, null, "conseil@x.tn", maintenant))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void en_attente_n_est_pas_une_decision() {
        assertThatThrownBy(() -> ValidationPrevision.avis(StatutValidation.EN_ATTENTE, "ok", "conseil@x.tn", maintenant))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void un_commentaire_trop_long_est_refuse() {
        String long_ = "x".repeat(ValidationPrevision.COMMENTAIRE_LONGUEUR_MAX + 1);

        assertThatThrownBy(() -> ValidationPrevision.avis(StatutValidation.REJETEE, long_, "conseil@x.tn", maintenant))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void un_financier_invite_doit_avoir_un_email_valide() {
        assertThatThrownBy(() -> MembreProjet.financier(1L, "pas-un-email")).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> MembreProjet.financier(1L, null)).isInstanceOf(DonneesInvalides.class);
        assertThat(MembreProjet.financier(1L, " A@B.tn ").email()).isEqualTo("a@b.tn");
    }
}
