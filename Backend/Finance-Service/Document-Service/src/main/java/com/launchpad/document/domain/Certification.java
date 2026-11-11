package com.launchpad.document.domain;

import com.launchpad.document.exception.DonneesInvalides;

import java.time.Instant;

/**
 * Certification d'un document par un financier invité sur le projet, avant son envoi à un investisseur.
 */
public record Certification(String auteur, String commentaire, Instant le) {

    public static final int COMMENTAIRE_LONGUEUR_MAX = 2000;

    public Certification {
        if (auteur == null || auteur.isBlank() || le == null) {
            throw new DonneesInvalides("Une certification doit indiquer son auteur et sa date");
        }
        commentaire = commentaire == null || commentaire.isBlank() ? null : commentaire.strip();
        if (commentaire != null && commentaire.length() > COMMENTAIRE_LONGUEUR_MAX) {
            throw new DonneesInvalides("commentaire ne doit pas dépasser " + COMMENTAIRE_LONGUEUR_MAX + " caractères");
        }
    }
}
