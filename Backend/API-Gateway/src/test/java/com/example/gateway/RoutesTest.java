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

        assertThat(uris).containsExactlyInAnyOrderEntriesOf(Map.of(
                "market-service", "lb://MARKET-SERVICE",
                "accounting-service", "lb://PROFESSIONAL-SERVICE",
                "lawyer-service", "lb://lawyer-space",
                "lawyer-docs", "lb://lawyer-space",
                "legal-service", "lb://LEGAL-SERVICE",
                "legal-docs", "lb://LEGAL-SERVICE",
                "legal-docs-json", "lb://LEGAL-SERVICE",
                "ai-service", "lb://AI-SERVICE",
                "finance-service", "lb://FINANCE-SERVICE",
                "user-service", "lb://USER-SERVICE"));
    }

    @Test
    void routesCarryTheServiceNameUsedIn503() {
        Map<String, Object> services = routes().stream()
                .collect(Collectors.toMap(Route::getId, r -> r.getMetadata().get("service")));
        assertThat(services).containsEntry("accounting-service", "PROFESSIONAL-SERVICE")
                .containsEntry("lawyer-docs", "lawyer-space")
                .containsEntry("user-service", "USER-SERVICE");
    }

    @Test
    void actuatorListsAllRoutes() {
        client.get().uri("/actuator/gateway/routes").exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(10)
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
