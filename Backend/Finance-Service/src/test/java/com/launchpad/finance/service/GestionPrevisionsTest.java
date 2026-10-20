package com.launchpad.finance.service;

import com.launchpad.finance.domain.EcartFinancier;
import com.launchpad.finance.domain.PrevisionFinanciere;
import com.launchpad.finance.domain.ProjectionFinanciere;
import com.launchpad.finance.domain.StatutEcart;
import com.launchpad.finance.exception.DonneesInvalides;
import com.launchpad.finance.exception.PrevisionIntrouvable;
import com.launchpad.finance.repository.PrevisionRepository;
import com.launchpad.finance.service.strategie.CroissanceParTaux;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.launchpad.finance.domain.Fixtures.PROJET_ID;
import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
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
