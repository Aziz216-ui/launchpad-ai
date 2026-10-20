package com.launchpad.finance.domain;

/**
 * Résultat d'un export : le fichier binaire, son nom et son type de contenu.
 */
public record FichierExporte(String nomFichier, String typeContenu, byte[] contenu) {
}
