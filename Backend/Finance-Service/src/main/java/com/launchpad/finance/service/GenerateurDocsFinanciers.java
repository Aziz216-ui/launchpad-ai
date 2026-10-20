package com.launchpad.finance.service;

import com.launchpad.finance.exception.DonneesInvalides;
import com.launchpad.finance.exception.PrevisionIntrouvable;
import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.EcartFinancier;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.Marges;
import com.launchpad.finance.domain.Montants;
import com.launchpad.finance.domain.PrevisionFinanciere;
import com.launchpad.finance.domain.ProjectionFinanciere;
import com.launchpad.finance.domain.SectionDocument;
import com.launchpad.finance.domain.TypeDocument;
import com.launchpad.finance.repository.PrevisionRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Génère le contenu structuré des documents financiers d'un projet à partir de sa prévision la plus récente.
 * Tous les tableaux (marges, écarts, projections, trésorerie) sont calculés ici, par le code.
 */
public class GenerateurDocsFinanciers {

    private static final List<String> COLONNE_MONTANT = List.of("Montant");
    private static final List<String> COLONNES_PROJECTIONS = List.of("Chiffre d'affaires", "Dépenses", "Marge");
    private static final String AUCUNE_PROJECTION = "Aucune projection pluriannuelle n'a été générée pour cette prévision.";

    private final PrevisionRepository previsions;
    private final CalculateurMarge calculateurMarge;
    private final ComparateurRevenusDepenses comparateur;

    public GenerateurDocsFinanciers(PrevisionRepository previsions, CalculateurMarge calculateurMarge,
                                    ComparateurRevenusDepenses comparateur) {
        this.previsions = previsions;
        this.calculateurMarge = calculateurMarge;
        this.comparateur = comparateur;
    }

    /**
     * Point d'entrée du scénario 3.
     *
     * @param tresorerieInitiale utilisée par le bilan d'ouverture et le plan de trésorerie ; 0 si null
     */
    public ContenuDocument generer(TypeDocument type, UUID projetId, BigDecimal tresorerieInitiale) {
        if (type == null) {
            throw new DonneesInvalides("Le type de document est obligatoire");
        }
        return switch (type) {
            case BUSINESS_PLAN -> genererBusinessPlan(projetId);
            case BILAN_OUVERTURE -> genererBilanOuverture(projetId, tresorerieInitiale);
            case COMPTE_RESULTAT -> genererCompteResultat(projetId);
            case PLAN_TRESORERIE -> genererPlanTresorerie(projetId, tresorerieInitiale);
            case RAPPORT_INVESTISSEUR -> genererRapportInvestisseur(projetId);
        };
    }

    public ContenuDocument genererBusinessPlan(UUID projetId) {
        PrevisionFinanciere p = prevision(projetId);
        return new ContenuDocument(titre(TypeDocument.BUSINESS_PLAN, p), List.of(
                sectionPrevision(p), sectionMarges(p), sectionEcart(p), sectionProjections(p)));
    }

    public ContenuDocument genererBilanOuverture(UUID projetId) {
        return genererBilanOuverture(projetId, null);
    }

    public ContenuDocument genererBilanOuverture(UUID projetId, BigDecimal tresorerieInitiale) {
        PrevisionFinanciere p = prevision(projetId);
        BigDecimal t0 = tresorerieInitiale(tresorerieInitiale);
        return new ContenuDocument(titre(TypeDocument.BILAN_OUVERTURE, p), List.of(
                new SectionDocument("Actif", COLONNE_MONTANT, List.of(
                        LigneDocument.de("Disponibilités", t0),
                        LigneDocument.de("Total actif", t0)), List.of()),
                new SectionDocument("Passif", COLONNE_MONTANT, List.of(
                        LigneDocument.de("Apports en capital", t0),
                        LigneDocument.de("Total passif", t0)),
                        List.of("Bilan établi à partir de la seule trésorerie initiale apportée au projet."))));
    }

    public ContenuDocument genererCompteResultat(UUID projetId) {
        PrevisionFinanciere p = prevision(projetId);
        BigDecimal margeBrute = calculateurMarge.calculerMargeBrute(p.chiffreAffaires(), p.coutsDirects());
        SectionDocument compte = new SectionDocument("Compte de résultat - " + p.periode(), COLONNE_MONTANT, List.of(
                LigneDocument.de("Chiffre d'affaires", p.chiffreAffaires()),
                LigneDocument.de("Coûts directs", p.coutsDirects()),
                LigneDocument.de("Marge brute", margeBrute),
                LigneDocument.de("Autres charges", Montants.arrondir(p.depenses().subtract(p.coutsDirects()))),
                LigneDocument.de("Résultat net", calculateurMarge.calculerMargeNette(p))), List.of());
        List<SectionDocument> sections = new ArrayList<>(List.of(compte));
        if (!p.projections().isEmpty()) {
            sections.add(new SectionDocument("Comptes de résultat projetés",
                    List.of("Chiffre d'affaires", "Charges", "Résultat"), lignesProjections(p), List.of()));
        }
        return new ContenuDocument(titre(TypeDocument.COMPTE_RESULTAT, p), sections);
    }

    public ContenuDocument genererPlanTresorerie(UUID projetId) {
        return genererPlanTresorerie(projetId, null);
    }

    /**
     * Par année : encaissements (CA), décaissements (dépenses), solde net et trésorerie cumulée depuis la
     * trésorerie initiale. Sans projection, une seule ligne issue de la prévision.
     */
    public ContenuDocument genererPlanTresorerie(UUID projetId, BigDecimal tresorerieInitiale) {
        PrevisionFinanciere p = prevision(projetId);
        BigDecimal cumul = tresorerieInitiale(tresorerieInitiale);
        List<LigneDocument> lignes = new ArrayList<>();
        if (p.projections().isEmpty()) {
            lignes.add(ligneTresorerie(p.periode(), p.chiffreAffaires(), p.depenses(), cumul));
        } else {
            for (ProjectionFinanciere proj : p.projections()) {
                LigneDocument ligne = ligneTresorerie("Année " + proj.annee(), proj.chiffreAffaires(), proj.depenses(), cumul);
                lignes.add(ligne);
                cumul = ligne.valeurs().get(3);
            }
        }
        return new ContenuDocument(titre(TypeDocument.PLAN_TRESORERIE, p), List.of(
                new SectionDocument("Trésorerie initiale", COLONNE_MONTANT,
                        List.of(LigneDocument.de("Trésorerie initiale", tresorerieInitiale(tresorerieInitiale))), List.of()),
                new SectionDocument("Plan de trésorerie",
                        List.of("Encaissements", "Décaissements", "Solde net", "Trésorerie cumulée"), lignes,
                        List.of("Encaissements = chiffre d'affaires ; décaissements = dépenses de l'année."))));
    }

    public ContenuDocument genererRapportInvestisseur(UUID projetId) {
        PrevisionFinanciere p = prevision(projetId);
        Marges marges = calculateurMarge.calculerMarges(p);
        EcartFinancier ecart = comparateur.comparer(p);
        List<SectionDocument> sections = new ArrayList<>();
        sections.add(new SectionDocument("Indicateurs clés", List.of("Valeur"), List.of(
                LigneDocument.de("Chiffre d'affaires", p.chiffreAffaires()),
                LigneDocument.de("Résultat net", marges.margeNette()),
                LigneDocument.de("Taux de marge brute (%)", marges.tauxMargeBrute()),
                LigneDocument.de("Taux de marge nette (%)", marges.tauxMargeNette()),
                LigneDocument.de("Écart revenus - dépenses (% du CA)", ecart.pourcentage())),
                List.of("Statut de l'écart : " + ecart.statut())));
        sections.add(sectionProjections(p));
        if (!p.projections().isEmpty()) {
            ProjectionFinanciere derniere = p.projections().get(p.projections().size() - 1);
            BigDecimal resultatCumule = p.projections().stream()
                    .map(ProjectionFinanciere::marge).reduce(BigDecimal.ZERO, BigDecimal::add);
            sections.add(new SectionDocument("Synthèse pluriannuelle", List.of("Valeur"), List.of(
                    LigneDocument.de("Chiffre d'affaires année " + derniere.annee(), derniere.chiffreAffaires()),
                    LigneDocument.de("Croissance cumulée du CA (%)", Montants.pourcentage(
                            derniere.chiffreAffaires().subtract(p.chiffreAffaires()), p.chiffreAffaires())),
                    LigneDocument.de("Résultat cumulé sur " + derniere.annee() + " an(s)",
                            Montants.exiger(resultatCumule, "Résultat cumulé"))), List.of()));
        }
        return new ContenuDocument(titre(TypeDocument.RAPPORT_INVESTISSEUR, p), sections);
    }

    private PrevisionFinanciere prevision(UUID projetId) {
        if (projetId == null) {
            throw new DonneesInvalides("projetId est obligatoire");
        }
        return previsions.findLatestByProjetId(projetId).orElseThrow(() -> PrevisionIntrouvable.pourProjet(projetId));
    }

    private static BigDecimal tresorerieInitiale(BigDecimal valeur) {
        return valeur == null ? Montants.ZERO : Montants.exigerPositifOuNul(valeur, "tresorerieInitiale");
    }

    private static String titre(TypeDocument type, PrevisionFinanciere p) {
        return type.libelle() + " - période " + p.periode();
    }

    private static LigneDocument ligneTresorerie(String libelle, BigDecimal encaissements, BigDecimal decaissements,
                                                 BigDecimal cumulPrecedent) {
        BigDecimal solde = Montants.arrondir(encaissements.subtract(decaissements));
        BigDecimal cumul = Montants.exiger(cumulPrecedent.add(solde), "Trésorerie cumulée");
        return LigneDocument.de(libelle, encaissements, decaissements, solde, cumul);
    }

    private static SectionDocument sectionPrevision(PrevisionFinanciere p) {
        return new SectionDocument("Prévision " + p.periode(), COLONNE_MONTANT, List.of(
                LigneDocument.de("Chiffre d'affaires", p.chiffreAffaires()),
                LigneDocument.de("Coûts directs", p.coutsDirects()),
                LigneDocument.de("Dépenses totales", p.depenses()),
                LigneDocument.de("Résultat", Montants.arrondir(p.calculerResultat()))), List.of());
    }

    private SectionDocument sectionMarges(PrevisionFinanciere p) {
        Marges m = calculateurMarge.calculerMarges(p);
        return new SectionDocument("Marges", List.of("Montant", "Taux (%)"), List.of(
                LigneDocument.de("Marge brute", m.margeBrute(), m.tauxMargeBrute()),
                LigneDocument.de("Marge nette", m.margeNette(), m.tauxMargeNette())), List.of());
    }

    private SectionDocument sectionEcart(PrevisionFinanciere p) {
        EcartFinancier e = comparateur.comparer(p);
        return new SectionDocument("Écart revenus - dépenses", List.of("Montant", "% du CA"),
                List.of(LigneDocument.de("Écart", e.montant(), e.pourcentage())),
                List.of("Statut : " + e.statut()));
    }

    private static SectionDocument sectionProjections(PrevisionFinanciere p) {
        return new SectionDocument("Projections pluriannuelles", COLONNES_PROJECTIONS, lignesProjections(p),
                p.projections().isEmpty() ? List.of(AUCUNE_PROJECTION) : List.of());
    }

    private static List<LigneDocument> lignesProjections(PrevisionFinanciere p) {
        return p.projections().stream()
                .map(proj -> LigneDocument.de("Année " + proj.annee(), proj.chiffreAffaires(), proj.depenses(), proj.marge()))
                .toList();
    }
}
