package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.ValidationPrevision;

import java.time.Instant;

/** Avis du financier ; commentaire, auteur et le sont null tant que le statut est EN_ATTENTE. */
public record ValidationResponse(StatutValidation statut, String commentaire, String auteur, Instant le) {

    public static ValidationResponse depuis(ValidationPrevision v) {
        return new ValidationResponse(v.statut(), v.commentaire(), v.auteur(), v.le());
    }
}
