package com.launchpad.document.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class Fixtures {

    public static final Long PROJET_ID = 1L;

    private Fixtures() {
    }

    /** CA 100 000, coûts directs 40 000, dépenses 70 000, sans projection (chiffres tels que renvoyés par Prevision). */
    public static SynthesePrevision synthese() {
        return synthese("100000", "40000", "70000");
    }

    /** CA 100 000, coûts directs 40 000, dépenses 70 000 ; projections +10 % / +5 % sur 2 ans. */
    public static SynthesePrevision syntheseAvecProjections() {
        SynthesePrevision s = synthese();
        return new SynthesePrevision(s.periode(), s.chiffreAffaires(), s.coutsDirects(), s.depenses(), s.resultat(),
                s.margeBrute(), s.margeNette(), s.tauxMargeBrute(), s.tauxMargeNette(), s.ecartMontant(),
                s.ecartPourcentage(), s.ecartStatut(), List.of(
                        new ProjectionSynthese(1, montant("110000.00"), montant("73500.00"), montant("36500.00")),
                        new ProjectionSynthese(2, montant("121000.00"), montant("77175.00"), montant("43825.00"))));
    }

    /** Reproduit les calculs du Prevision-Service (marges brute et nette, taux en % du CA, écart revenus - dépenses). */
    public static SynthesePrevision synthese(String ca, String coutsDirects, String depenses) {
        BigDecimal chiffreAffaires = Montants.arrondir(montant(ca));
        BigDecimal couts = Montants.arrondir(montant(coutsDirects));
        BigDecimal charges = Montants.arrondir(montant(depenses));
        BigDecimal resultat = chiffreAffaires.subtract(charges);
        BigDecimal margeBrute = chiffreAffaires.subtract(couts);
        String statut = resultat.signum() > 0 ? "EXCEDENT" : resultat.signum() == 0 ? "EQUILIBRE" : "DEFICIT";
        return new SynthesePrevision("2026", chiffreAffaires, couts, charges, resultat, margeBrute, resultat,
                Montants.pourcentage(margeBrute, chiffreAffaires), Montants.pourcentage(resultat, chiffreAffaires),
                resultat, Montants.pourcentage(resultat, chiffreAffaires), statut, List.of());
    }

    public static BigDecimal montant(String valeur) {
        return new BigDecimal(valeur);
    }
}
