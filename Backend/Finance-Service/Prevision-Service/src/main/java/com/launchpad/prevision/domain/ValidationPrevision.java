package com.launchpad.prevision.domain;

import com.launchpad.prevision.exception.DonneesInvalides;

import java.time.Instant;

/**
 * Avis d'un financier sur une prévision : statut, commentaire, auteur et date.
 * EN_ATTENTE n'a ni commentaire, ni auteur, ni date. Un rejet doit être motivé par un commentaire.
 */
public record ValidationPrevision(StatutValidation statut, String commentaire, String auteur, Instant le) {

    public static final int COMMENTAIRE_LONGUEUR_MAX = 2000;

    public static final ValidationPrevision EN_ATTENTE = new ValidationPrevision(StatutValidation.EN_ATTENTE, null,
            null, null);

    public ValidationPrevision {
        if (statut == null) {
            throw new DonneesInvalides("Le statut de validation est obligatoire");
        }
        commentaire = commentaire == null || commentaire.isBlank() ? null : commentaire.strip();
        if (commentaire != null && commentaire.length() > COMMENTAIRE_LONGUEUR_MAX) {
            throw new DonneesInvalides("commentaire ne doit pas dépasser " + COMMENTAIRE_LONGUEUR_MAX + " caractères");
        }
        if (statut == StatutValidation.EN_ATTENTE) {
            commentaire = null;
            auteur = null;
            le = null;
        } else if (auteur == null || auteur.isBlank() || le == null) {
            throw new DonneesInvalides("Un avis doit indiquer son auteur et sa date");
        }
    }

    /** Avis d'un financier : VALIDEE ou REJETEE (le rejet exige un commentaire). */
    public static ValidationPrevision avis(StatutValidation decision, String commentaire, String auteur, Instant le) {
        if (decision == null || decision == StatutValidation.EN_ATTENTE) {
            throw new DonneesInvalides("decision doit valoir VALIDEE ou REJETEE");
        }
        if (decision == StatutValidation.REJETEE && (commentaire == null || commentaire.isBlank())) {
            throw new DonneesInvalides("Un rejet doit être motivé par un commentaire");
        }
        return new ValidationPrevision(decision, commentaire, auteur, le);
    }
}
