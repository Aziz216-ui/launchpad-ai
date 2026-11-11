package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.RoleProjet;

import java.time.Instant;

public record MembreResponse(Long projetId, String email, RoleProjet role, Instant ajouteLe) {

    public static MembreResponse depuis(MembreProjet m) {
        return new MembreResponse(m.projetId(), m.email(), m.role(), m.ajouteLe());
    }
}
