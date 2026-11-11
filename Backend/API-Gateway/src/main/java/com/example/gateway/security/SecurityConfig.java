package com.example.gateway.security;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.config.GlobalCorsProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.server.resource.web.server.authentication.ServerBearerTokenAuthenticationConverter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.ServerAuthenticationEntryPoint;
import org.springframework.security.web.server.context.NoOpServerSecurityContextRepository;
import org.springframework.security.web.server.savedrequest.NoOpServerRequestCache;
import org.springframework.security.web.server.util.matcher.OrServerWebExchangeMatcher;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatchers;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import com.example.gateway.web.JsonResponses;

import reactor.core.publisher.Mono;

/**
 * Sécurité de la gateway : JWT Keycloak (RS256, clés lues sur KEYCLOAK_JWK_SET_URI).
 *
 * JWT_ENABLED=false (défaut) : tout est ouvert, pour tester sans Keycloak.
 * JWT_ENABLED=true : routes publiques ci-dessous et OPTIONS ouvertes, tout le reste
 * exige un JWT valide (sinon 401 {"message": "Token manquant ou invalide"}).
 * Dans les deux cas, l'en-tête Authorization est transmis tel quel aux services.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    /** Routes accessibles sans token : authentification, documentations, health checks. */
    public static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/**",
            // Docs des 4 services de l'étude de marché : /api/market/<ressource>/docs/ et /schema/
            "/api/market/*/docs/**", "/api/market/*/schema/**",
            "/api/comptable/docs", "/api/comptable/docs/**", "/api/comptable/docs.json",
            // Docs des 3 services IA : la page /docs/ai/<service>/docs/ charge /api/ai/schema/
            "/api/ai/docs/**", "/api/ai/schema/**",
            "/docs/**",
            // Docs avocat : la page /docs/lawyer/<service>/swagger-ui/ charge /v3/api-docs/
            "/v3/api-docs/**",
            // Docs utilisateurs : la page /docs/user/docs/ charge /api/schema/
            "/api/schema/**",
            "/api/market/*/health", "/api/market/*/health/",
            "/api/ai/health", "/api/ai/health/",
            "/api/comptable/health",
            "/actuator/health", "/actuator/health/**");

    /**
     * Routes réservées aux appels entre services (réseau interne, sans passer par la gateway) : refusées ici,
     * avec ou sans token. /api/finance/ia/analyse déclenche un appel payant au LLM pour le Document-Service.
     */
    public static final List<String> INTERNAL_PATHS = List.of("/api/finance/ia/**");

    static final String INTERNAL_MESSAGE = "Route interne : non accessible via la gateway";
    static final String UNAUTHORIZED_MESSAGE = "Token manquant ou invalide";
    static final String FORBIDDEN_MESSAGE = "Acces refuse : role insuffisant";

    @Bean
    SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http,
            @Value("${launchpad.security.jwt-enabled}") boolean jwtEnabled,
            CorsConfigurationSource corsConfigurationSource) {
        // API sans session ni formulaire : pas de CSRF, de cookie de session ni de page de login
        http.csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .logout(ServerHttpSecurity.LogoutSpec::disable)
                .securityContextRepository(NoOpServerSecurityContextRepository.getInstance())
                .requestCache(cache -> cache.requestCache(NoOpServerRequestCache.getInstance()))
                // CORS appliqué ici (et non après le routage) pour qu'il soit aussi sur les 401
                .cors(cors -> cors.configurationSource(corsConfigurationSource));

        if (!jwtEnabled) {
            return http.authorizeExchange(auth -> auth
                            .pathMatchers(INTERNAL_PATHS.toArray(String[]::new)).denyAll()
                            .anyExchange().permitAll())
                    .exceptionHandling(errors -> errors.accessDeniedHandler((exchange, ex) -> JsonResponses.write(
                            exchange.getResponse(), HttpStatus.FORBIDDEN, Map.of("message", INTERNAL_MESSAGE))))
                    .build();
        }

        ServerWebExchangeMatcher publicRoutes = new OrServerWebExchangeMatcher(
                ServerWebExchangeMatchers.pathMatchers(PUBLIC_PATHS.toArray(String[]::new)),
                ServerWebExchangeMatchers.pathMatchers(HttpMethod.OPTIONS, "/**"));
        ServerAuthenticationEntryPoint unauthorized = (exchange, ex) -> JsonResponses.write(
                exchange.getResponse(), HttpStatus.UNAUTHORIZED, Map.of("message", UNAUTHORIZED_MESSAGE));

        // Sur une route publique, un token expiré ou invalide est ignoré (pas de 401)
        ServerBearerTokenAuthenticationConverter bearer = new ServerBearerTokenAuthenticationConverter();
        return http
                .authorizeExchange(auth -> auth
                        .pathMatchers(INTERNAL_PATHS.toArray(String[]::new)).denyAll()
                        .matchers(publicRoutes).permitAll()
                        // Finance : chaque service vérifie lui-même le rôle sur le projet (le
                        // propriétaire supprime ses documents et retire ses financiers).
                        .pathMatchers(HttpMethod.DELETE, "/api/finance/**").authenticated()
                        // Autorisation par rôle : ailleurs, un utilisateur connecté ne peut pas
                        // supprimer, seul un ADMIN (rôle Keycloak) le peut. Les autres méthodes restent
                        // ouvertes à tout utilisateur authentifié (contrôles fins dans les services).
                        .pathMatchers(HttpMethod.DELETE, "/**").hasRole("ADMIN")
                        .anyExchange().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(new KeycloakRoleConverter()))
                        .bearerTokenConverter(exchange -> publicRoutes.matches(exchange)
                                .flatMap(match -> match.isMatch() ? Mono.empty() : bearer.convert(exchange)))
                        .authenticationEntryPoint(unauthorized))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(unauthorized)
                        // Authentifié mais rôle insuffisant : 403 (et non 401)
                        .accessDeniedHandler((exchange, ex) -> JsonResponses.write(
                                exchange.getResponse(), HttpStatus.FORBIDDEN, Map.of("message", FORBIDDEN_MESSAGE))))
                .build();
    }

    /** Configuration CORS lue dans spring.cloud.gateway.server.webflux.globalcors (application.yml). */
    @Bean
    CorsConfigurationSource corsConfigurationSource(GlobalCorsProperties properties) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.setCorsConfigurations(properties.getCorsConfigurations());
        return source;
    }
}
