package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.Utilisateur;

import java.util.Optional;

/**
 * Port : utilisateur à l'origine de la requête (implémenté à partir du jeton JWT, voir config).
 * <p>
 * Vide quand aucun utilisateur n'est authentifié, c'est-à-dire :
 * <ul>
 *   <li>sécurité désactivée (JWT_ENABLED=false, développement et tests) ;</li>
 *   <li>appel interne d'un autre service sans jeton, sur l'une des rares routes ouvertes à ces appels
 *       (synthèse d'un projet, analyse IA d'un document) : voir SecuriteConfig.</li>
 * </ul>
 * Dans ces deux cas le contrôle d'accès laisse passer : la passerelle exige toujours un jeton pour un
 * utilisateur venant de l'extérieur.
 */
public interface UtilisateurCourant {

    Optional<Utilisateur> utilisateur();
}
