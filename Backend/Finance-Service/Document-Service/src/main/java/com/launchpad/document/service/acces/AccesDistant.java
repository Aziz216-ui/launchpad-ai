package com.launchpad.document.service.acces;

import com.launchpad.document.domain.DroitsProjet;

/**
 * Port vers le Prevision-Service, qui tient les membres des projets (propriétaire, financiers invités).
 */
public interface AccesDistant {

    /**
     * Droits de l'utilisateur de la requête en cours sur le projet (son jeton est relayé).
     *
     * @throws com.launchpad.document.exception.ServiceIndisponible le Prevision-Service ne répond pas
     */
    DroitsProjet droits(Long projetId);
}
