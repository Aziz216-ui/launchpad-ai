package com.launchpad.document.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
 * finance.securite.active=false (défaut, JWT_ENABLED=false) : tout est ouvert, comme la passerelle.
 * finance.securite.active=true : toute requête métier exige un jeton valide (documentation et health check
 * exceptés). Le rôle de chacun sur un projet est vérifié par ControleAcces, pas ici.
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

        AuthenticationEntryPoint nonAuthentifie = (requete, reponse, exception) -> ecrire(reponse, objectMapper);
        return http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/swagger-ui.html",
                                "/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults())
                        .authenticationEntryPoint(nonAuthentifie))
                .exceptionHandling(e -> e.authenticationEntryPoint(nonAuthentifie))
                .build();
    }

    private static void ecrire(HttpServletResponse reponse, ObjectMapper objectMapper) throws IOException {
        ProblemDetail probleme = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Jeton manquant ou invalide");
        probleme.setTitle("Non authentifié");
        reponse.setStatus(HttpStatus.UNAUTHORIZED.value());
        reponse.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(reponse.getOutputStream(), probleme);
    }
}
