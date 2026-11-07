package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.SyntheseFinanciere;

public record SyntheseResponse(PrevisionResponse prevision, MargesResponse marges, EcartResponse ecart) {

    public static SyntheseResponse depuis(SyntheseFinanciere s) {
        return new SyntheseResponse(PrevisionResponse.depuis(s.prevision()),
                MargesResponse.depuis(s.prevision().id(), s.marges()),
                EcartResponse.depuis(s.prevision().id(), s.ecart()));
    }
}
