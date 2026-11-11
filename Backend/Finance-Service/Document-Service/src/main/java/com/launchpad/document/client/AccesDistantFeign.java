package com.launchpad.document.client;

import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.exception.AccesRefuse;
import com.launchpad.document.exception.ServiceIndisponible;
import com.launchpad.document.service.acces.AccesDistant;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adaptateur du port AccesDistant : demande au Prevision-Service les droits de l'utilisateur sur le projet
 * (GET /api/finance/projets/{id}/acces, jeton relayé). Sans réponse exploitable, l'accès n'est jamais accordé :
 * 401/403 deviennent un refus, une panne un 503.
 */
@Component
public class AccesDistantFeign implements AccesDistant {

    private static final Logger LOG = LoggerFactory.getLogger(AccesDistantFeign.class);

    private final PrevisionFeignClient previsions;

    public AccesDistantFeign(PrevisionFeignClient previsions) {
        this.previsions = previsions;
    }

    @Override
    public DroitsProjet droits(Long projetId) {
        try {
            DroitsJson json = previsions.acces(projetId);
            if (json == null) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            return new DroitsProjet(projetId, json.lecture(), json.ecriture(), json.validation());
        } catch (FeignException e) {
            if (e.status() == 401 || e.status() == 403) {
                throw new AccesRefuse("Vous n'avez pas accès au projet " + projetId);
            }
            LOG.warn("Prevision-Service injoignable ou en erreur (droits sur le projet {})", projetId, e);
            throw new ServiceIndisponible("Le service des prévisions est momentanément indisponible");
        }
    }

    /** Forme JSON de DroitsResponse (Prevision-Service) ; les champs inconnus sont ignorés. */
    public record DroitsJson(boolean lecture, boolean ecriture, boolean validation) {
    }
}
