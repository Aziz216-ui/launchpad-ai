package com.launchpad.finance.service;

import com.launchpad.finance.domain.EcartFinancier;
import com.launchpad.finance.domain.HypothesesPrevisionnelles;
import com.launchpad.finance.domain.Marges;
import com.launchpad.finance.domain.PrevisionFinanciere;
import com.launchpad.finance.domain.ProjectionFinanciere;
import com.launchpad.finance.exception.PrevisionIntrouvable;
import com.launchpad.finance.repository.PrevisionRepository;
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
