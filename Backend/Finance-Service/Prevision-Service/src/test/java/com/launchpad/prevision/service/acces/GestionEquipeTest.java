package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.ProjetAccessible;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.exception.AccesRefuse;
import com.launchpad.prevision.exception.DonneesInvalides;
import com.launchpad.prevision.exception.MembreIntrouvable;
import com.launchpad.prevision.repository.MembreProjetRepository;
import com.launchpad.prevision.repository.PrevisionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static com.launchpad.prevision.service.acces.AccesFixtures.ENTREPRENEUR;
import static com.launchpad.prevision.service.acces.AccesFixtures.FINANCIER;
import static com.launchpad.prevision.service.acces.AccesFixtures.connecte;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GestionEquipeTest {

    private static final Long PROJET = 7L;

    private final MembreProjetRepository membres = mock(MembreProjetRepository.class);
    private final PrevisionRepository previsions = mock(PrevisionRepository.class);

    private GestionEquipe pour(Utilisateur utilisateur) {
        UtilisateurCourant courant = connecte(utilisateur);
        return new GestionEquipe(membres, previsions, new ControleAcces(membres, courant), courant);
    }

    private MembreProjet proprietaire() {
        MembreProjet p = MembreProjet.proprietaire(PROJET, ENTREPRENEUR);
        when(membres.findProprietaire(PROJET)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    void le_proprietaire_invite_un_financier_par_email_normalise() {
        proprietaire();
        when(membres.findFinancier(PROJET, "conseil@launchpad.tn")).thenReturn(Optional.empty());
        when(membres.save(any())).thenAnswer(i -> i.getArgument(0));

        MembreProjet invite = pour(ENTREPRENEUR).inviterFinancier(PROJET, "  Conseil@LaunchPad.tn ");

        assertThat(invite.role()).isEqualTo(RoleProjet.FINANCIER);
        assertThat(invite.email()).isEqualTo("conseil@launchpad.tn");
    }

    @Test
    void reinviter_le_meme_financier_renvoie_l_invitation_existante() {
        proprietaire();
        MembreProjet existant = MembreProjet.financier(PROJET, "conseil@launchpad.tn");
        when(membres.findFinancier(PROJET, "conseil@launchpad.tn")).thenReturn(Optional.of(existant));

        assertThat(pour(ENTREPRENEUR).inviterFinancier(PROJET, "conseil@launchpad.tn")).isEqualTo(existant);
        verify(membres, never()).save(any());
    }

    @Test
    void le_proprietaire_ne_peut_pas_s_inviter_lui_meme() {
        proprietaire();

        assertThatThrownBy(() -> pour(ENTREPRENEUR).inviterFinancier(PROJET, ENTREPRENEUR.email()))
                .isInstanceOf(DonneesInvalides.class);
    }

    @Test
    void un_financier_ne_peut_pas_inviter_ni_retirer() {
        proprietaire();
        when(membres.findFinancier(PROJET, FINANCIER.email()))
                .thenReturn(Optional.of(MembreProjet.financier(PROJET, FINANCIER.email())));

        assertThatThrownBy(() -> pour(FINANCIER).inviterFinancier(PROJET, "autre@launchpad.tn"))
                .isInstanceOf(AccesRefuse.class);
        assertThatThrownBy(() -> pour(FINANCIER).retirerFinancier(PROJET, FINANCIER.email()))
                .isInstanceOf(AccesRefuse.class);
        verify(membres, never()).delete(any());
    }

    @Test
    void retirer_un_financier_inconnu_leve_membre_introuvable() {
        proprietaire();
        when(membres.findFinancier(PROJET, "inconnu@launchpad.tn")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> pour(ENTREPRENEUR).retirerFinancier(PROJET, "inconnu@launchpad.tn"))
                .isInstanceOf(MembreIntrouvable.class);
    }

    @Test
    void mes_projets_d_un_financier_liste_ses_invitations_et_les_previsions_a_valider() {
        when(membres.findProprietesDe(FINANCIER.id())).thenReturn(List.of());
        when(membres.findInvitationsDe(FINANCIER.email()))
                .thenReturn(List.of(MembreProjet.financier(PROJET, FINANCIER.email())));
        when(previsions.countByProjetIdAndStatut(PROJET, StatutValidation.EN_ATTENTE)).thenReturn(2L);

        List<ProjetAccessible> projets = pour(FINANCIER).mesProjets();

        assertThat(projets).singleElement().satisfies(p -> {
            assertThat(p.projetId()).isEqualTo(PROJET);
            assertThat(p.role()).isEqualTo(RoleProjet.FINANCIER);
            assertThat(p.previsionsEnAttente()).isEqualTo(2L);
        });
    }

    @Test
    void mes_projets_d_un_entrepreneur_ignore_les_invitations_faute_de_role_financier() {
        Utilisateur entrepreneur = new Utilisateur("sub-e", "conseil@launchpad.tn", Set.of("ENTREPRENEUR"));
        when(membres.findProprietesDe("sub-e")).thenReturn(List.of());

        assertThat(pour(entrepreneur).mesProjets()).isEmpty();
        verify(membres, never()).findInvitationsDe(any());
    }
}
