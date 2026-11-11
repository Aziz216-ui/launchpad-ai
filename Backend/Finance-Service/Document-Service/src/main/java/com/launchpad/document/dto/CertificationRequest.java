package com.launchpad.document.dto;

import com.launchpad.document.domain.Certification;
import jakarta.validation.constraints.Size;

/** Commentaire facultatif du financier qui certifie le document. */
public record CertificationRequest(@Size(max = Certification.COMMENTAIRE_LONGUEUR_MAX) String commentaire) {
}
