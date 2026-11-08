package com.launchpad.prevision.service;

import com.launchpad.prevision.domain.EcartFinancier;
import com.launchpad.prevision.domain.HypothesesPrevisionnelles;
import com.launchpad.prevision.domain.Marges;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.ProjectionFinanciere;
import com.launchpad.prevision.domain.SyntheseFinanciere;
import com.launchpad.prevision.exception.PrevisionIntrouvable;
import com.launchpad.prevision.repository.PrevisionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Cas d'usage des scénarios 1 (prévision, marges, écarts) et 2 (projections pluriannuelles).
 */
@Service
@Transactional(readOnly = true)
public class GestionPrevisions {

    private final PrevisionRepository previsions;
    private final CalculateurMarge calculateurMarge;
    private final ComparateurRevenusDepenses comparateur;
    private final ModelePrevisionnel modelePrevisionnel;

    public GestionPrevisions(PrevisionRepository previsions, CalculateurMarge calculateurMarge,
                             ComparateurRevenusDepenses comparateur, ModelePrevisionnel modelePrevisionnel) {
        this.previsions = previsions;
        this.calculateurMarge = calculateurMarge;
        this.comparateur = comparateur;
        this.modelePrevisionnel = modelePrevisionnel;
    }

    /** Scénario 1 : valide (par le modèle métier), calcule le résultat et sauvegarde. */
    @Transactional
    public PrevisionFinanciere creerPrevision(UUID projetId, String periode, BigDecimal chiffreAffaires,
                                              BigDecimal coutsDirects, BigDecimal depenses) {
        PrevisionFinanciere prevision = PrevisionFinanciere.creer(projetId, periode, chiffreAffaires, coutsDirects,
                depenses);
        return previsions.save(prevision);
    }

    public PrevisionFinanciere consulterPrevision(UUID previsionId) {
        return previsions.findById(previsionId).orElseThrow(() -> new PrevisionIntrouvable(previsionId));
    }

    public List<PrevisionFinanciere> listerPrevisions(UUID projetId) {
        return previsions.findByProjetId(projetId);
    }

    /** Prévision la plus récente du projet avec ses marges et son écart : consommée par le Document-Service. */
    public SyntheseFinanciere consulterSynthese(UUID projetId) {
        PrevisionFinanciere prevision = previsions.findLatestByProjetId(projetId)
                .orElseThrow(() -> PrevisionIntrouvable.pourProjet(projetId));
        return new SyntheseFinanciere(prevision, calculateurMarge.calculerMarges(prevision),
                comparateur.comparer(prevision));
    }

    /** Scénario 1, cas alt (a). */
    public Marges consulterMarges(UUID previsionId) {
        return calculateurMarge.calculerMarges(consulterPrevision(previsionId));
    }

    /** Scénario 1, cas alt (b). */
    public EcartFinancier comparerRevenusDepenses(UUID previsionId) {
        return comparateur.comparer(consulterPrevision(previsionId));
    }

    /** Scénario 2 : les nouvelles projections remplacent les anciennes dans la même transaction. */
    @Transactional
    public List<ProjectionFinanciere> genererProjections(UUID previsionId, BigDecimal tauxCa, BigDecimal tauxDepenses,
                                                         int horizon) {
        PrevisionFinanciere prevision = consulterPrevision(previsionId);
        HypothesesPrevisionnelles hypotheses = HypothesesPrevisionnelles.depuis(prevision, tauxCa, tauxDepenses);
        List<ProjectionFinanciere> projections = modelePrevisionnel.genererProjections(hypotheses, horizon);
        previsions.replaceProjections(previsionId, projections);
        return projections;
    }

    public List<ProjectionFinanciere> consulterProjections(UUID previsionId) {
        return consulterPrevision(previsionId).projections();
    }
}
