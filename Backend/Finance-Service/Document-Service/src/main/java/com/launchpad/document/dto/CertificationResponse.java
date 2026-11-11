package com.launchpad.document.dto;

import com.launchpad.document.domain.Certification;

import java.time.Instant;

public record CertificationResponse(String auteur, String commentaire, Instant le) {

    /** null si le document n'est pas certifié. */
    public static CertificationResponse depuis(Certification c) {
        return c == null ? null : new CertificationResponse(c.auteur(), c.commentaire(), c.le());
    }
}
