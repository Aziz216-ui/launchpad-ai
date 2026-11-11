package com.launchpad.document.config;

import com.launchpad.document.service.acces.UtilisateurCourant;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

/**
 * Adaptateur du port UtilisateurCourant : e-mail (à défaut sub) du jeton Keycloak de la requête en cours.
 */
@Component
public class UtilisateurCourantJwt implements UtilisateurCourant {

    @Override
    public Optional<String> signature() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentification instanceof JwtAuthenticationToken jeton)) {
            return Optional.empty();
        }
        return Optional.of(signature(jeton.getToken()));
    }

    static String signature(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        return email == null || email.isBlank() ? jwt.getSubject() : email.strip().toLowerCase(Locale.ROOT);
    }
}
