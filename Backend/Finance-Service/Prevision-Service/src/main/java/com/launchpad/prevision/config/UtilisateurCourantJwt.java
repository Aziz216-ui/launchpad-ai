package com.launchpad.prevision.config;

import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.service.acces.UtilisateurCourant;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Adaptateur du port UtilisateurCourant : lit le jeton Keycloak de la requête en cours
 * (sub, email et realm_access.roles).
 */
@Component
public class UtilisateurCourantJwt implements UtilisateurCourant {

    @Override
    public Optional<Utilisateur> utilisateur() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentification instanceof JwtAuthenticationToken jeton)) {
            return Optional.empty();
        }
        return Optional.of(depuis(jeton.getToken()));
    }

    static Utilisateur depuis(Jwt jwt) {
        return new Utilisateur(jwt.getSubject(), jwt.getClaimAsString("email"), roles(jwt));
    }

    private static Set<String> roles(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (!(realmAccess instanceof Map<?, ?> map) || !(map.get("roles") instanceof List<?> roles)) {
            return Set.of();
        }
        return roles.stream().filter(String.class::isInstance).map(r -> ((String) r).toUpperCase())
                .collect(Collectors.toSet());
    }
}
