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
                Map.entry("accounting-document-service", "lb://ACCOUNTING-DOCUMENT-SERVICE"),
                Map.entry("accounting-message-service", "lb://ACCOUNTING-MESSAGE-SERVICE"),
                Map.entry("accounting-client-file-service", "lb://ACCOUNTING-CLIENT-FILE-SERVICE"),
                Map.entry("accounting-workspace-service", "lb://ACCOUNTING-WORKSPACE-SERVICE"),
                Map.entry("lawyer-client-service", "lb://lawyer-client-service"),
                Map.entry("lawyer-message-service", "lb://lawyer-message-service"),
                Map.entry("lawyer-docreview-service", "lb://lawyer-docreview-service"),
                Map.entry("lawyer-client-docs", "lb://lawyer-client-service"),
                Map.entry("lawyer-message-docs", "lb://lawyer-message-service"),
                Map.entry("lawyer-docreview-docs", "lb://lawyer-docreview-service"),
                Map.entry("lawyer-client-schema", "lb://lawyer-client-service"),
                Map.entry("lawyer-message-schema", "lb://lawyer-message-service"),
                Map.entry("lawyer-docreview-schema", "lb://lawyer-docreview-service"),
                Map.entry("legal-service", "lb://LEGAL-SERVICE"),
                Map.entry("legal-docs", "lb://LEGAL-SERVICE"),
                Map.entry("legal-docs-json", "lb://LEGAL-SERVICE"),
                Map.entry("clause-service", "lb://CLAUSE-SERVICE"),
                Map.entry("commentaire-service", "lb://COMMENTAIRE-SERVICE"),
                Map.entry("ai-projet-docs", "lb://PROJET-SERVICE"),
                Map.entry("ai-recommandation-docs", "lb://RECOMMANDATION-SERVICE"),
                Map.entry("ai-conversation-docs", "lb://CONVERSATION-SERVICE"),
                Map.entry("ai-recommandation-schema", "lb://RECOMMANDATION-SERVICE"),
                Map.entry("ai-conversation-schema", "lb://CONVERSATION-SERVICE"),
                Map.entry("ai-projet-service", "lb://PROJET-SERVICE"),
                Map.entry("ai-recommandation-service", "lb://RECOMMANDATION-SERVICE"),
                Map.entry("ai-conversation-service", "lb://CONVERSATION-SERVICE"),
                Map.entry("document-service", "lb://DOCUMENT-SERVICE"),
                Map.entry("prevision-service", "lb://PREVISION-SERVICE"),
                Map.entry("user-service", "lb://user-service"),
                Map.entry("user-docs", "lb://user-service"),
                Map.entry("user-schema", "lb://user-service")));
    }

    /** Finance : la route Document-Service (chemins précis) doit passer avant /api/finance/** (Prevision-Service). */
    @Test
    void financeDocumentRouteIsEvaluatedBeforePrevisionCatchAll() {
        List<String> ids = routes().stream().map(Route::getId).toList();
        assertThat(ids.indexOf("document-service")).isNotNegative()
                .isLessThan(ids.indexOf("prevision-service"));
    }

    /** Comptable : documents et messages d'un dossier avant /files/**, et workspace-service (/api/comptable/**) en dernier. */
    @Test
    void accountingRoutesAreEvaluatedFromMostToLeastSpecific() {
        List<String> ids = routes().stream().map(Route::getId).toList();
        assertThat(ids.indexOf("accounting-document-service")).isNotNegative()
                .isLessThan(ids.indexOf("accounting-client-file-service"));
        assertThat(ids.indexOf("accounting-message-service")).isNotNegative()
                .isLessThan(ids.indexOf("accounting-client-file-service"));
        assertThat(ids.indexOf("accounting-client-file-service"))
                .isLessThan(ids.indexOf("accounting-workspace-service"));
    }

    /** IA : les schémas choisis par Referer passent avant ai-projet-service, qui prend /api/ai/schema/ par défaut. */
    @Test
    void aiSchemaRoutesAreEvaluatedBeforeProjetDefault() {
        List<String> ids = routes().stream().map(Route::getId).toList();
        assertThat(ids.indexOf("ai-recommandation-schema")).isNotNegative()
                .isLessThan(ids.indexOf("ai-projet-service"));
        assertThat(ids.indexOf("ai-conversation-schema")).isNotNegative()
                .isLessThan(ids.indexOf("ai-projet-service"));
    }

    @Test
    void routesCarryTheServiceNameUsedIn503() {
        Map<String, Object> services = routes().stream()
                .collect(Collectors.toMap(Route::getId, r -> r.getMetadata().get("service")));
        assertThat(services).containsEntry("accounting-workspace-service", "ACCOUNTING-WORKSPACE-SERVICE")
                .containsEntry("accounting-document-service", "ACCOUNTING-DOCUMENT-SERVICE")
                .containsEntry("market-swot-service", "SWOT-SERVICE")
                .containsEntry("market-etude-docs", "ETUDE-SERVICE")
                .containsEntry("lawyer-client-docs", "lawyer-client-service")
                .containsEntry("lawyer-docreview-schema", "lawyer-docreview-service")
                .containsEntry("ai-recommandation-service", "RECOMMANDATION-SERVICE")
                .containsEntry("ai-conversation-docs", "CONVERSATION-SERVICE")
                .containsEntry("user-service", "user-service")
                .containsEntry("user-schema", "user-service");
    }

    @Test
    void actuatorListsAllRoutes() {
        client.get().uri("/actuator/gateway/routes").exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(39)
                .jsonPath("$[?(@.route_id == 'accounting-workspace-service')].uri").isEqualTo("lb://ACCOUNTING-WORKSPACE-SERVICE")
                .jsonPath("$[?(@.route_id == 'lawyer-message-service')].uri").isEqualTo("lb://lawyer-message-service");
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
