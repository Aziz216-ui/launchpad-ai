package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.DroitsProjet;
import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.exception.AccesRefuse;
import com.launchpad.prevision.repository.MembreProjetRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static com.launchpad.prevision.service.acces.AccesFixtures.AUTRE_ENTREPRENEUR;
import static com.launchpad.prevision.service.acces.AccesFixtures.ENTREPRENEUR;
import static com.launchpad.prevision.service.acces.AccesFixtures.FINANCIER;
import static com.launchpad.prevision.service.acces.AccesFixtures.connecte;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ControleAccesTest {

    private static final Long PROJET = 7L;

    private final MembreProjetRepository membres = mock(MembreProjetRepository.class);

    private ControleAcces pour(Utilisateur utilisateur) {
        return new ControleAcces(membres, connecte(utilisateur));
    }

    private void proprietaire(Utilisateur u) {
        when(membres.findProprietaire(PROJET)).thenReturn(Optional.of(MembreProjet.proprietaire(PROJET, u)));
    }

    private void financierInvite(String email) {
        when(membres.findFinancier(PROJET, email)).thenReturn(Optional.of(MembreProjet.financier(PROJET, email)));
    }

    @Test
    void le_proprietaire_lit_et_ecrit_mais_ne_valide_pas() {
        proprietaire(ENTREPRENEUR);

        DroitsProjet droits = pour(ENTREPRENEUR).droits(PROJET);

        assertThat(droits).isEqualTo(new DroitsProjet(PROJET, RoleProjet.PROPRIETAIRE, true, true, false));
        assertThatThrownBy(() -> pour(ENTREPRENEUR).exigerValidation(PROJET)).isInstanceOf(AccesRefuse.class);
    }

    @Test
    void le_financier_invite_lit_et_valide_mais_n_ecrit_pas() {
        proprietaire(ENTREPRENEUR);
        financierInvite(FINANCIER.email());

        DroitsProjet droits = pour(FINANCIER).droits(PROJET);

        assertThat(droits).isEqualTo(new DroitsProjet(PROJET, RoleProjet.FINANCIER, true, false, true));
        assertThat(pour(FINANCIER).exigerValidation(PROJET)).isEqualTo(FINANCIER.email());
        assertThatThrownBy(() -> pour(FINANCIER).exigerEcriture(PROJET)).isInstanceOf(AccesRefuse.class);
    }

    @Test
    void un_financier_non_invite_n_a_aucun_acces() {
        proprietaire(ENTREPRENEUR);

        assertThat(pour(FINANCIER).droits(PROJET).role()).isEqualTo(RoleProjet.AUCUN);
        assertThatThrownBy(() -> pour(FINANCIER).exigerLecture(PROJET)).isInstanceOf(AccesRefuse.class);
    }

    @Test
    void une_invitation_ne_vaut_que_pour_un_compte_financier() {
        Utilisateur entrepreneurInvite = new Utilisateur("sub-x", "conseil@launchpad.tn", Set.of("ENTREPRENEUR"));
        proprietaire(ENTREPRENEUR);

        assertThat(pour(entrepreneurInvite).droits(PROJET).lecture()).isFalse();
    }

    @Test
    void un_autre_entrepreneur_n_a_aucun_acces_au_projet() {
        proprietaire(ENTREPRENEUR);

        assertThat(pour(AUTRE_ENTREPRENEUR).droits(PROJET).role()).isEqualTo(RoleProjet.AUCUN);
        assertThatThrownBy(() -> pour(AUTRE_ENTREPRENEUR).exigerEcritureEtReserver(PROJET))
                .isInstanceOf(AccesRefuse.class);
        verify(membres, never()).save(any());
    }

    @Test
    void un_projet_libre_est_reserve_par_l_entrepreneur_qui_y_ecrit_en_premier() {
        when(membres.findProprietaire(PROJET)).thenReturn(Optional.empty());

        assertThat(pour(ENTREPRENEUR).droits(PROJET)).isEqualTo(DroitsProjet.projetLibre(PROJET));
        pour(ENTREPRENEUR).exigerEcritureEtReserver(PROJET);

        verify(membres).save(argThat(m -> m.role() == RoleProjet.PROPRIETAIRE
                && m.utilisateurId().equals(ENTREPRENEUR.id()) && m.projetId().equals(PROJET)));
    }

    @Test
    void un_financier_ne_peut_pas_reserver_un_projet_libre() {
        when(membres.findProprietaire(PROJET)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pour(FINANCIER).exigerEcritureEtReserver(PROJET)).isInstanceOf(AccesRefuse.class);
    }

    @Test
    void admin_et_appel_sans_utilisateur_ont_tous_les_droits() {
        Utilisateur admin = new Utilisateur("sub-admin", null, Set.of("ADMIN"));

        assertThat(pour(admin).droits(PROJET).role()).isEqualTo(RoleProjet.ADMIN);
        assertThat(new ControleAcces(membres, Optional::empty).droits(PROJET).validation()).isTrue();
        assertThat(new ControleAcces(membres, Optional::empty).exigerValidation(PROJET))
                .isEqualTo(ControleAcces.AUTEUR_SYSTEME);
    }
}
