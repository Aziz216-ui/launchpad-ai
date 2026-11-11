package com.launchpad.document.domain;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * Empreinte (SHA-256) des chiffres d'une prévision : période, montants et projections.
 * <p>
 * Un document la retient à sa génération ; à la certification, elle est recalculée sur la prévision actuelle.
 * Si les chiffres ont changé entre-temps (nouvelles projections), le document ne reflète plus la prévision
 * validée et ne peut pas être certifié tel quel. Les montants sont normalisés (100000 = 100000.00).
 */
public final class EmpreintePrevision {

    private EmpreintePrevision() {
    }

    public static String de(String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects, BigDecimal depenses,
                            List<ProjectionSynthese> projections) {
        StringBuilder texte = new StringBuilder()
                .append(periode).append('|').append(normaliser(chiffreAffaires)).append('|')
                .append(normaliser(coutsDirects)).append('|').append(normaliser(depenses));
        for (ProjectionSynthese p : projections == null ? List.<ProjectionSynthese>of() : projections) {
            texte.append('|').append(p.annee()).append(':').append(normaliser(p.chiffreAffaires())).append(':')
                    .append(normaliser(p.depenses())).append(':').append(normaliser(p.marge()));
        }
        return sha256(texte.toString());
    }

    private static String normaliser(BigDecimal montant) {
        return montant == null ? "" : montant.stripTrailingZeros().toPlainString();
    }

    private static String sha256(String texte) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(texte.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
    }
}
