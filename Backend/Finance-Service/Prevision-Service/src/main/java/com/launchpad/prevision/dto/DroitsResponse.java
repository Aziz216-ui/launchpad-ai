package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.DroitsProjet;
import com.launchpad.prevision.domain.RoleProjet;

/** Droits de l'utilisateur courant sur un projet (utilisés par le Document-Service et le frontend). */
public record DroitsResponse(Long projetId, RoleProjet role, boolean lecture, boolean ecriture, boolean validation) {

    public static DroitsResponse depuis(DroitsProjet d) {
        return new DroitsResponse(d.projetId(), d.role(), d.lecture(), d.ecriture(), d.validation());
    }
}
