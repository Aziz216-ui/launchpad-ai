package com.launchpad.prevision.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Relaie le jeton de l'utilisateur sur les appels Feign vers les autres services Finance : le service appelé
 * applique ainsi les droits de ce même utilisateur. Sans utilisateur authentifié, rien n'est ajouté.
 */
@Component
public class RelaisJetonFeign implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate requete) {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (authentification instanceof JwtAuthenticationToken jeton && !requete.headers()
                .containsKey(HttpHeaders.AUTHORIZATION)) {
            requete.header(HttpHeaders.AUTHORIZATION, "Bearer " + jeton.getToken().getTokenValue());
        }
    }
}
