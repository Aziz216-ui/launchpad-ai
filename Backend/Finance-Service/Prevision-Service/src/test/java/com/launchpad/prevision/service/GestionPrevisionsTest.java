package com.launchpad.prevision.service;

import com.launchpad.prevision.domain.EcartFinancier;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.ProjectionFinanciere;
import com.launchpad.prevision.domain.StatutEcart;
import com.launchpad.prevision.domain.SyntheseFinanciere;
import com.launchpad.prevision.exception.DonneesInvalides;
import com.launchpad.prevision.exception.PrevisionIntrouvable;
import com.launchpad.prevision.repository.PrevisionRepository;
import com.launchpad.prevision.service.strategie.CroissanceParTaux;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.launchpad.prevision.domain.Fixtures.PROJET_ID;
import static com.launchpad.prevision.domain.Fixtures.montant;
import static com.launchpad.prevision.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GestionPrevisionsTest {

    @Mock
    private PrevisionRepository previsions;

    private GestionPrevisions gestion;

    @BeforeEach
    void setUp() {
        gestion = new GestionPrevisions(previsions, new CalculateurMarge(), new ComparateurRevenusDepenses(),
                new ModelePrevisionnel(new CroissanceParTaux()));
    }

    @Test
    void synthese_regroupe_la_derniere_prevision_ses_marges_et_son_ecart() {
        PrevisionFinanciere derniere = prevision();
        when(previsions.findLatestByProjetId(PROJET_ID)).thenReturn(Optional.of(derniere));

        SyntheseFinanciere synthese = gestion.consulterSynthese(PROJET_ID);

        assertThat(synthese.prevision()).isEqualTo(derniere);
        assertThat(synthese.marges().margeBrute()).isEqualByComparingTo("60000");
        assertThat(synthese.marges().tauxMargeNette()).isEqualByComparingTo("30");
        assertThat(synthese.ecart().statut()).isEqualTo(StatutEcart.EXCEDENT);
    }

    @Test
    void synthese_sans_prevision_leve_prevision_introuvable() {
        when(previsions.findLatestByProjetId(PROJET_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gestion.consulterSynthese(PROJET_ID)).isInstanceOf(PrevisionIntrouvable.class);
    }

    @Test
    void creer_prevision_valide_puis_sauvegarde() {
        when(previsions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        PrevisionFinanciere creee = gestion.creerPrevision(PROJET_ID, "2026", montant("100000"), montant("40000"),
                montant("70000"));

        assertThat(creee.id()).isNotNull();
        assertThat(creee.calculerResultat()).isEqualTo(montant("30000.00"));
        verify(previsions).save(creee);
    }

    @Test
    void creer_prevision_invalide_ne_sauvegarde_rien() {
        assertThatThrownBy(() -> gestion.creerPrevision(PROJET_ID, "2026", montant("100"), montant("90"),
                montant("50"))).isInstanceOf(DonneesInvalides.class);
        verify(previsions, never()).save(any());
    }

    @Test
    void comparer_revenus_depenses_d_une_prevision_existante() {
        PrevisionFinanciere p = prevision();
        when(previsions.findById(p.id())).thenReturn(Optional.of(p));

        assertThat(gestion.comparerRevenusDepenses(p.id()))
                .isEqualTo(new EcartFinancier(montant("30000.00"), montant("30.00"), StatutEcart.EXCEDENT));
    }

    @Test
    void prevision_inconnue_leve_prevision_introuvable() {
        UUID inconnue = UUID.randomUUID();
        when(previsions.findById(inconnue)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gestion.consulterMarges(inconnue)).isInstanceOf(PrevisionIntrouvable.class);
        assertThatThrownBy(() -> gestion.genererProjections(inconnue, montant("10"), montant("5"), 3))
                .isInstanceOf(PrevisionIntrouvable.class);
        verify(previsions, never()).replaceProjections(any(), anyList());
    }

    @Test
    void generer_projections_remplace_les_projections_existantes() {
        PrevisionFinanciere p = prevision();
        when(previsions.findById(p.id())).thenReturn(Optional.of(p));

        List<ProjectionFinanciere> projections = gestion.genererProjections(p.id(), montant("10"), montant("5"), 2);

        assertThat(projections).extracting(ProjectionFinanciere::chiffreAffaires)
                .containsExactly(montant("110000.00"), montant("121000.00"));
        verify(previsions).replaceProjections(p.id(), projections);
    }

    @Test
    void horizon_invalide_ne_remplace_rien() {
        PrevisionFinanciere p = prevision();
        when(previsions.findById(p.id())).thenReturn(Optional.of(p));

        assertThatThrownBy(() -> gestion.genererProjections(p.id(), montant("10"), montant("5"), 0))
                .isInstanceOf(DonneesInvalides.class);
        verify(previsions, never()).replaceProjections(any(), anyList());
    }
}
