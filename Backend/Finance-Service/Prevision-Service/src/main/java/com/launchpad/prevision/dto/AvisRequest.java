package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.ValidationPrevision;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** decision : VALIDEE ou REJETEE ; commentaire obligatoire pour un rejet. */
public record AvisRequest(@NotNull StatutValidation decision,
                          @Size(max = ValidationPrevision.COMMENTAIRE_LONGUEUR_MAX) String commentaire) {
}
