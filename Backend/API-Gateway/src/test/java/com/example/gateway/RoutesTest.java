package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.core.env.Environment;

/**
 * Profil par défaut (eureka) : toutes les routes du tableau des services sont chargées,
 * en lb://<NOM-EUREKA>. Le client Eureka est coupé pour ne pas dépendre d'un serveur.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = "eureka.client.enabled=false")
class RoutesTest extends GatewayTestSupport {

    @Autowired
    RouteLocator routeLocator;

    @Autowired
    Environment environment;

    @Test
    void eurekaIsTheDefaultProfile() {
        assertThat(environment.getActiveProfiles()).isEmpty();
        assertThat(environment.getDefaultProfiles()).containsExactly("eureka");
        // application-eureka.yml est bien chargé
        assertThat(environment.getProperty("eureka.client.service-url.defaultZone"))
                .isEqualTo("http://localhost:8761/eureka/");
        assertThat(environment.getProperty("server.port")).isEqualTo("0"); // RANDOM_PORT en test
        assertThat(environment.getProperty("spring.application.name")).isEqualTo("API-GATEWAY");
    }

    @Test
    void allServiceRoutesAreLoadedWithLoadBalancedUris() {
        Map<String, String> uris = routes().stream()
                .collect(Collectors.toMap(Route::getId, r -> r.getUri().toString()));

        assertThat(uris).containsExactlyInAnyOrderEntriesOf(Map.ofEntries(
                Map.entry("market-secteur-docs", "lb://SECTEUR-SERVICE"),
                Map.entry("market-concurrent-docs", "lb://CONCURRENT-SERVICE"),
                Map.entry("market-swot-docs", "lb://SWOT-SERVICE"),
                Map.entry("market-etude-docs", "lb://ETUDE-SERVICE"),
                Map.entry("market-secteur-service", "lb://SECTEUR-SERVICE"),
                Map.entry("market-concurrent-service", "lb://CONCURRENT-SERVICE"),
                Map.entry("market-swot-service", "lb://SWOT-SERVICE"),
                Map.entry("market-etude-service", "lb://ETUDE-SERVICE"),
                Map.entry("accounting-service", "lb://PROFESSIONAL-SERVICE"),
                Map.entry("lawyer-service", "lb://lawyer-space"),
                Map.entry("lawyer-docs", "lb://lawyer-space"),
                Map.entry("legal-service", "lb://LEGAL-SERVICE"),
                Map.entry("legal-docs", "lb://LEGAL-SERVICE"),
                Map.entry("legal-docs-json", "lb://LEGAL-SERVICE"),
                Map.entry("ai-service", "lb://AI-SERVICE"),
                Map.entry("document-service", "lb://DOCUMENT-SERVICE"),
                Map.entry("prevision-service", "lb://PREVISION-SERVICE"),
                Map.entry("user-service", "lb://USER-SERVICE")));
    }

    /** Finance : la route Document-Service (chemins précis) doit passer avant /api/finance/** (Prevision-Service). */
    @Test
    void financeDocumentRouteIsEvaluatedBeforePrevisionCatchAll() {
        List<String> ids = routes().stream().map(Route::getId).toList();
        assertThat(ids.indexOf("document-service")).isNotNegative()
                .isLessThan(ids.indexOf("prevision-service"));
    }

    @Test
    void routesCarryTheServiceNameUsedIn503() {
        Map<String, Object> services = routes().stream()
                .collect(Collectors.toMap(Route::getId, r -> r.getMetadata().get("service")));
        assertThat(services).containsEntry("accounting-service", "PROFESSIONAL-SERVICE")
                .containsEntry("market-swot-service", "SWOT-SERVICE")
                .containsEntry("market-etude-docs", "ETUDE-SERVICE")
                .containsEntry("lawyer-docs", "lawyer-space")
                .containsEntry("user-service", "USER-SERVICE");
    }

    @Test
    void actuatorListsAllRoutes() {
        client.get().uri("/actuator/gateway/routes").exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(18)
                .jsonPath("$[?(@.route_id == 'accounting-service')].uri").isEqualTo("lb://PROFESSIONAL-SERVICE")
                .jsonPath("$[?(@.route_id == 'lawyer-service')].uri").isEqualTo("lb://lawyer-space");
    }

    @Test
    void actuatorHealthIsUp() {
        client.get().uri("/actuator/health").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("UP");
    }

    private List<Route> routes() {
        return routeLocator.getRoutes().collectList().block();
    }
}
