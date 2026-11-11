package com.launchpad.prevision.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;

import java.io.IOException;

/**
 * Sécurité du service : jeton JWT Keycloak (mêmes clés que l'API Gateway, KEYCLOAK_JWK_SET_URI).
 * <p>
 * finance.securite.active=false (défaut, JWT_ENABLED=false) : tout est ouvert, comme la passerelle ; le contrôle
 * d'accès par projet laisse alors tout passer (aucun utilisateur connu).
 * <p>
 * finance.securite.active=true : toute requête exige un jeton valide, sauf :
 * <ul>
 *   <li>documentation et health check ;</li>
 *   <li>GET /projets/{id}/synthese et POST /ia/analyse, appelés par d'autres services de la plateforme
 *       (Projet-Service IA, Document-Service) directement sur le réseau interne. Si un jeton accompagne
 *       l'appel, il est quand même vérifié et les droits de son utilisateur s'appliquent.</li>
 * </ul>
 * Le rôle de chacun sur un projet (propriétaire, financier) est vérifié par ControleAcces, pas ici.
 */
@Configuration(proxyBeanMethods = false)
public class SecuriteConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            @Value("${finance.securite.active:false}") boolean active,
                                            ObjectMapper objectMapper) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!active) {
            return http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll()).build();
        }

        AuthenticationEntryPoint nonAuthentifie = (requete, reponse, exception) -> ecrire(reponse, objectMapper,
                HttpStatus.UNAUTHORIZED, "Non authentifié", "Jeton manquant ou invalide");
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/swagger-ui.html",
                                "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/finance/projets/*/synthese").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/finance/ia/analyse").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults())
                        .authenticationEntryPoint(nonAuthentifie))
                .exceptionHandling(e -> e.authenticationEntryPoint(nonAuthentifie))
                .build();
    }

    private static void ecrire(jakarta.servlet.http.HttpServletResponse reponse, ObjectMapper objectMapper,
                               HttpStatus statut, String titre, String detail) throws IOException {
        ProblemDetail probleme = ProblemDetail.forStatusAndDetail(statut, detail);
        probleme.setTitle(titre);
        reponse.setStatus(statut.value());
        reponse.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(reponse.getOutputStream(), probleme);
    }
}
