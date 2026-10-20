package com.launchpad.finance.domain;

import java.math.BigDecimal;

public enum StatutEcart {
    EXCEDENT,
    EQUILIBRE,
    DEFICIT;

    public static StatutEcart depuis(BigDecimal montantEcart) {
        int signe = montantEcart.signum();
        if (signe > 0) {
            return EXCEDENT;
        }
        return signe == 0 ? EQUILIBRE : DEFICIT;
    }
}
