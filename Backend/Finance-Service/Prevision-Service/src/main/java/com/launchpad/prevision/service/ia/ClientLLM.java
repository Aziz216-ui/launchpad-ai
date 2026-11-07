package com.launchpad.prevision.service.ia;

/**
 * Port vers le modèle de langage : isole Spring AI du reste du service.
 * Toute défaillance (non configuré, timeout, erreur du fournisseur) est signalée par IaIndisponible.
 */
public interface ClientLLM {

    /** Rédaction à partir de consignes et de chiffres déjà calculés. */
    String generer(String consignes, String donnees);

    /** Échange avec outils : le modèle peut appeler les méthodes @Tool des objets fournis. */
    String converser(String consignes, String message, Object... outils);
}
