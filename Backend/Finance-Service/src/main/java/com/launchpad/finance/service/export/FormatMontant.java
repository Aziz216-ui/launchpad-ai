package com.launchpad.finance.service.export;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Mise en forme commune aux exports : montants « 60 000,00 » et dates UTC.
 */
final class FormatMontant {

    static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private FormatMontant() {
    }

    static String formater(BigDecimal montant) {
        DecimalFormatSymbols symboles = new DecimalFormatSymbols();
        symboles.setGroupingSeparator(' ');
        symboles.setDecimalSeparator(',');
        symboles.setMinusSign('-');
        return new DecimalFormat("#,##0.00", symboles).format(montant);
    }
}
