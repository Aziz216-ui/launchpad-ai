package com.launchpad.document.domain;

import java.math.BigDecimal;

/**
 * Projection d'une prévision pour l'année n, telle que fournie par le Prevision-Service.
 */
public record ProjectionSynthese(int annee, BigDecimal chiffreAffaires, BigDecimal depenses, BigDecimal marge) {
}
