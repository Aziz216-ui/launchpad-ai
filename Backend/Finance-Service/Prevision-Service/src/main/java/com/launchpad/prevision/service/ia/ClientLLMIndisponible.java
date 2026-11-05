package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.exception.IaIndisponible;

/**
 * Utilisé quand aucun fournisseur LLM n'est configuré (aucune clé d'API) : le service démarre quand même.
 */
public class ClientLLMIndisponible implements ClientLLM {

    private static final String MESSAGE = "Le service d'IA n'est pas configuré";

    @Override
    public String generer(String consignes, String donnees) {
        throw new IaIndisponible(MESSAGE);
    }

    @Override
    public String converser(String consignes, String message, Object... outils) {
        throw new IaIndisponible(MESSAGE);
    }
}
