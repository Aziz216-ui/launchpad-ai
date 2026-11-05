package com.launchpad.document.service.stockage;

/**
 * Port vers l'interface requise IDocuments : stockage des fichiers exportés (patron Adapter).
 */
public interface StockageDocuments {

    /** Enregistre (ou remplace) le fichier sous la clé donnée. */
    void enregistrer(String cle, byte[] contenu, String typeContenu);

    /** Supprime le fichier s'il existe ; sans effet sinon. */
    void supprimer(String cle);
}
