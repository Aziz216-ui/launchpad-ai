package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.ProjetAccessible;
import com.launchpad.prevision.domain.RoleProjet;

import java.time.Instant;

public record ProjetAccessibleResponse(Long projetId, RoleProjet role, Instant depuis, long previsionsEnAttente) {

    public static ProjetAccessibleResponse depuis(ProjetAccessible p) {
        return new ProjetAccessibleResponse(p.projetId(), p.role(), p.depuis(), p.previsionsEnAttente());
    }
}
