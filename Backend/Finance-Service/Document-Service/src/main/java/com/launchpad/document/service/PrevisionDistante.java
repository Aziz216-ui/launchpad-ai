package com.launchpad.document.service;

import com.launchpad.document.domain.SynthesePrevision;

import java.util.UUID;

/**
 * Port vers le Prevision-Service (patron Adapter : implémenté par PrevisionDistanteRest).
 */
public interface PrevisionDistante {

    /**
     * Dernière prévision du projet avec ses marges, son écart et ses projections.
     *
     * @throws com.launchpad.document.exception.PrevisionIntrouvable le projet n'a aucune prévision
     * @throws com.launchpad.document.exception.ServiceIndisponible  le Prevision-Service ne répond pas
     */
    SynthesePrevision derniereSynthese(Long projetId);

    /**
     * État actuel de la prévision : statut de validation et empreinte de ses chiffres.
     *
     * @throws com.launchpad.document.exception.PrevisionIntrouvable la prévision n'existe plus
     * @throws com.launchpad.document.exception.ServiceIndisponible  le Prevision-Service ne répond pas
     */
    com.launchpad.document.domain.EtatPrevision etat(java.util.UUID previsionId);
}
