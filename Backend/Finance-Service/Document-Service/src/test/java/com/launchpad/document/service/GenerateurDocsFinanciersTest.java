package com.launchpad.document.service;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.LigneDocument;
import com.launchpad.document.domain.SectionDocument;
import com.launchpad.document.domain.SynthesePrevision;
import com.launchpad.document.domain.TypeDocument;
import com.launchpad.document.exception.DonneesInvalides;
import com.launchpad.document.exception.PrevisionIntrouvable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static com.launchpad.document.domain.Fixtures.montant;
import static com.launchpad.document.domain.Fixtures.synthese;
import static com.launchpad.document.domain.Fixtures.syntheseAvecProjections;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GenerateurDocsFinanciersTest {

    @Mock
    private PrevisionDistante previsions;

    private GenerateurDocsFinanciers generateur;

    @BeforeEach
    void setUp() {
        generateur = new GenerateurDocsFinanciers(previsions);
    }

    private void dernierePrevision(SynthesePrevision p) {
        when(previsions.derniereSynthese(PROJET_ID)).thenReturn(p);
    }

    private static SectionDocument section(ContenuDocument contenu, String titre) {
        return contenu.sections().stream().filter(s -> s.titre().equals(titre)).findFirst().orElseThrow();
    }

    private static List<java.math.BigDecimal> valeurs(SectionDocument section, String libelle) {
        return section.lignes().stream().filter(l -> l.libelle().equals(libelle)).findFirst()
                .map(LigneDocument::valeurs).orElseThrow();
    }

    @ParameterizedTest
    @EnumSource(TypeDocument.class)
    void chaque_type_produit_un_document_coherent(TypeDocument type) {
        dernierePrevision(syntheseAvecProjections());

        ContenuDocument contenu = generateur.generer(type, PROJET_ID, null);

        assertThat(contenu.titre()).isEqualTo(type.libelle() + " - période 2026");
        assertThat(contenu.sections()).isNotEmpty().allSatisfy(s -> assertThat(s.lignes())
                .allSatisfy(l -> assertThat(l.valeurs()).hasSameSizeAs(s.colonnes())));
    }

    @Test
    void business_plan_contient_marges_ecart_et_projections() {
        dernierePrevision(syntheseAvecProjections());

        ContenuDocument contenu = generateur.genererBusinessPlan(PROJET_ID);

        assertThat(contenu.sections()).extracting(SectionDocument::titre).containsExactly(
                "Prévision 2026", "Marges", "Écart revenus - dépenses", "Projections pluriannuelles");
        assertThat(valeurs(section(contenu, "Marges"), "Marge brute")).containsExactly(montant("60000.00"), montant("60.00"));
        assertThat(valeurs(section(contenu, "Marges"), "Marge nette")).containsExactly(montant("30000.00"), montant("30.00"));
        assertThat(section(contenu, "Écart revenus - dépenses").notes()).containsExactly("Statut : Excédent");
        assertThat(valeurs(section(contenu, "Projections pluriannuelles"), "Année 2"))
                .containsExactly(montant("121000.00"), montant("77175.00"), montant("43825.00"));
    }

    @Test
    void compte_de_resultat_decompose_les_charges() {
        dernierePrevision(synthese());

        ContenuDocument contenu = generateur.genererCompteResultat(PROJET_ID);

        SectionDocument compte = section(contenu, "Compte de résultat - 2026");
        assertThat(compte.lignes()).extracting(l -> l.valeurs().get(0)).containsExactly(
                montant("100000.00"), montant("40000.00"), montant("60000.00"), montant("30000.00"), montant("30000.00"));
        assertThat(contenu.sections()).hasSize(1);
    }

    @Test
    void plan_de_tresorerie_cumule_depuis_la_tresorerie_initiale() {
        dernierePrevision(syntheseAvecProjections());

        ContenuDocument contenu = generateur.genererPlanTresorerie(PROJET_ID, montant("10000"));

        SectionDocument plan = section(contenu, "Plan de trésorerie");
        assertThat(plan.colonnes()).containsExactly("Encaissements", "Décaissements", "Solde net", "Trésorerie cumulée");
        assertThat(valeurs(plan, "Année 1")).containsExactly(
                montant("110000.00"), montant("73500.00"), montant("36500.00"), montant("46500.00"));
        assertThat(valeurs(plan, "Année 2")).containsExactly(
                montant("121000.00"), montant("77175.00"), montant("43825.00"), montant("90325.00"));
        assertThat(valeurs(section(contenu, "Trésorerie initiale"), "Trésorerie initiale"))
                .containsExactly(montant("10000.00"));
    }

    @Test
    void plan_de_tresorerie_sans_projection_utilise_la_prevision_et_une_tresorerie_initiale_nulle() {
        dernierePrevision(synthese("8000", "1000", "10000"));

        ContenuDocument contenu = generateur.genererPlanTresorerie(PROJET_ID);

        assertThat(section(contenu, "Plan de trésorerie").lignes()).singleElement().satisfies(l -> {
            assertThat(l.libelle()).isEqualTo("2026");
            assertThat(l.valeurs()).containsExactly(
                    montant("8000.00"), montant("10000.00"), montant("-2000.00"), montant("-2000.00"));
        });
    }

    @Test
    void bilan_d_ouverture_equilibre_actif_et_passif() {
        dernierePrevision(synthese());

        ContenuDocument contenu = generateur.genererBilanOuverture(PROJET_ID, montant("25000"));

        assertThat(valeurs(section(contenu, "Actif"), "Total actif")).containsExactly(montant("25000.00"));
        assertThat(valeurs(section(contenu, "Passif"), "Total passif")).containsExactly(montant("25000.00"));
    }

    @Test
    void rapport_investisseur_synthetise_la_croissance() {
        dernierePrevision(syntheseAvecProjections());

        ContenuDocument contenu = generateur.genererRapportInvestisseur(PROJET_ID);

        SectionDocument indicateurs = section(contenu, "Indicateurs clés");
        assertThat(valeurs(indicateurs, "Taux de marge nette (%)")).containsExactly(montant("30.00"));
        assertThat(indicateurs.notes()).containsExactly("Statut de l'écart : Excédent");
        SectionDocument synthese = section(contenu, "Synthèse pluriannuelle");
        assertThat(valeurs(synthese, "Croissance cumulée du CA (%)")).containsExactly(montant("21.00"));
        assertThat(valeurs(synthese, "Résultat cumulé sur 2 an(s)")).containsExactly(montant("80325.00"));
    }

    @Test
    void rapport_investisseur_sans_projection_le_signale() {
        dernierePrevision(synthese());

        ContenuDocument contenu = generateur.genererRapportInvestisseur(PROJET_ID);

        assertThat(contenu.sections()).extracting(SectionDocument::titre)
                .containsExactly("Indicateurs clés", "Projections pluriannuelles");
        assertThat(section(contenu, "Projections pluriannuelles").notes()).isNotEmpty();
    }

    @Test
    void projet_sans_prevision_leve_prevision_introuvable() {
        Long projetSansPrevision = 999L;
        when(previsions.derniereSynthese(projetSansPrevision)).thenThrow(PrevisionIntrouvable.pourProjet(projetSansPrevision));

        assertThatThrownBy(() -> generateur.generer(TypeDocument.BUSINESS_PLAN, projetSansPrevision, null))
                .isInstanceOf(PrevisionIntrouvable.class)
                .hasMessageContaining(projetSansPrevision.toString());
    }

    @Test
    void type_absent_ou_tresorerie_negative_refuses() {
        dernierePrevision(synthese());

        assertThatThrownBy(() -> generateur.generer(null, PROJET_ID, null)).isInstanceOf(DonneesInvalides.class);
        assertThatThrownBy(() -> generateur.genererPlanTresorerie(PROJET_ID, montant("-1")))
                .isInstanceOf(DonneesInvalides.class);
    }
}
