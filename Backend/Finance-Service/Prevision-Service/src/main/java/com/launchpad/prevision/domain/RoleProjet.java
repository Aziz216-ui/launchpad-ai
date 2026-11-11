package com.launchpad.prevision.domain;

/**
 * Rôle d'un utilisateur sur UN projet (différent de son rôle Keycloak sur la plateforme).
 * <ul>
 *   <li>PROPRIETAIRE : l'entrepreneur qui saisit les chiffres et invite des financiers ;</li>
 *   <li>FINANCIER : conseiller invité, en lecture seule, qui valide les prévisions et certifie les documents ;</li>
 *   <li>ADMIN : administrateur de la plateforme, tous les droits ;</li>
 *   <li>AUCUN : pas d'accès.</li>
 * </ul>
 */
public enum RoleProjet {
    PROPRIETAIRE,
    FINANCIER,
    ADMIN,
    AUCUN
}
