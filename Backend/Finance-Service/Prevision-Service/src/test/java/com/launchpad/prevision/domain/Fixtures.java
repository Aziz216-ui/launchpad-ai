package com.launchpad.prevision.domain;

import java.math.BigDecimal;
import java.util.UUID;

public final class Fixtures {

    public static final Long PROJET_ID = 1L;

    private Fixtures() {
    }

    /** CA 100 000, coûts directs 40 000, dépenses 70 000. */
    public static PrevisionFinanciere prevision() {
        return prevision("100000", "40000", "70000");
    }

    public static PrevisionFinanciere prevision(String ca, String coutsDirects, String depenses) {
        return PrevisionFinanciere.creer(PROJET_ID, "2026", new BigDecimal(ca), new BigDecimal(coutsDirects),
                new BigDecimal(depenses));
    }

    public static BigDecimal montant(String valeur) {
        return new BigDecimal(valeur);
    }
}
