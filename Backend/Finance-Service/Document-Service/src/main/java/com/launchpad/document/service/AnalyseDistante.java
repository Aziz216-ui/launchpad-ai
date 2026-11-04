package com.launchpad.document.service;

import com.launchpad.document.domain.ContenuDocument;

import java.util.List;

/**
 * Port vers l'IA, hébergée par le Prevision-Service (patron Adapter : implémenté par AnalyseDistanteRest).
 */
public interface AnalyseDistante {

    /**
     * Paragraphes d'analyse rédigés à partir des tableaux du document.
     *
     * @throws com.launchpad.document.exception.IaIndisponible      le LLM n'est pas configuré ou ne répond pas
     * @throws com.launchpad.document.exception.ServiceIndisponible le Prevision-Service ne répond pas
     */
    List<String> analyser(ContenuDocument contenu);
}
