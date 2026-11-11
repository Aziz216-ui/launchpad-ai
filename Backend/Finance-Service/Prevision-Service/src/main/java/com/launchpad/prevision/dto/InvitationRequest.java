package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.MembreProjet;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** E-mail du compte FINANCIER à inviter sur le projet. */
public record InvitationRequest(@NotBlank @Email @Size(max = MembreProjet.EMAIL_LONGUEUR_MAX) String email) {
}
