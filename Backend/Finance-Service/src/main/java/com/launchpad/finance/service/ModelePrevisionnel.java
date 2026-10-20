package com.launchpad.finance.service;

import com.launchpad.finance.exception.DonneesInvalides;
import com.launchpad.finance.domain.HypothesesPrevisionnelles;
import com.launchpad.finance.domain.ProjectionFinanciere;
import com.launchpad.finance.service.strategie.StrategieProjection;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Modèle prévisionnel (contexte du patron Strategy) : délègue chaque estimation à sa StrategieProjection.
 */
public class ModelePrevisionnel {

    public static final int HORIZON_MIN = 1;
    public static final int HORIZON_MAX = 10;

    private final StrategieProjection strategie;

    public ModelePrevisionnel(StrategieProjection strategie) {
        this.strategie = strategie;
    }

    public BigDecimal estimerChiffreAffaires(HypothesesPrevisionnelles hypotheses, int annee) {
        return strategie.projeterChiffreAffaires(hypotheses, annee);
    }

    public BigDecimal estimerDepensesPrevisionnelles(HypothesesPrevisionnelles hypotheses, int annee) {
        return strategie.projeterDepenses(hypotheses, annee);
    }

    /** Boucle n = 1..horizon : CA(n), dépenses(n) et résultat(n). */
    public List<ProjectionFinanciere> genererProjections(HypothesesPrevisionnelles hypotheses, int horizon) {
        if (horizon < HORIZON_MIN || horizon > HORIZON_MAX) {
            throw new DonneesInvalides("horizon doit être compris entre " + HORIZON_MIN + " et " + HORIZON_MAX + " ans");
        }
        List<ProjectionFinanciere> projections = new ArrayList<>(horizon);
        for (int annee = 1; annee <= horizon; annee++) {
            projections.add(ProjectionFinanciere.de(annee,
                    estimerChiffreAffaires(hypotheses, annee),
                    estimerDepensesPrevisionnelles(hypotheses, annee)));
        }
        return List.copyOf(projections);
    }
}
