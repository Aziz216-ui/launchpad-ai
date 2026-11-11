package com.launchpad.document.service.acces;

import java.util.Optional;

/**
 * Port : utilisateur à l'origine de la requête (lu dans le jeton JWT, voir config).
 * Vide quand la sécurité est désactivée (JWT_ENABLED=false) : le contrôle d'accès laisse alors tout passer.
 */
public interface UtilisateurCourant {

    /** Nom affiché comme auteur (e-mail, à défaut identifiant Keycloak), ou vide sans utilisateur authentifié. */
    Optional<String> signature();
}
