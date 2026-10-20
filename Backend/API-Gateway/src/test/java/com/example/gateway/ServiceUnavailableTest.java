package com.example.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;

/** Service éteint ou absent d'Eureka : 503 {"service": "<NOM>", "message": "Service indisponible"}. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class ServiceUnavailableTest extends GatewayTestSupport {

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        String closed = MockService.closedPortUrl();
        registry.add("launchpad.services.legal.uri", () -> closed);
        registry.add("launchpad.services.lawyer.uri", () -> closed);
    }

    @Test
    void directUrlWithNothingListeningGives503Json() {
        client.get().uri("/api/legal/contrats").exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectBody().json("{\"service\":\"LEGAL-SERVICE\",\"message\":\"Service indisponible\"}", JsonCompareMode.STRICT);
    }

    @Test
    void lowercaseEurekaNameIsKeptInTheMessage() {
        client.get().uri("/api/lawyer/dossiers").exchange()
                .expectStatus().isEqualTo(503)
                .expectBody().jsonPath("$.service").isEqualTo("lawyer-space");
    }

    @Test
    void loadBalancedRouteWithoutInstanceGives503Json() {
        // ai-service reste en lb://AI-SERVICE en profil local : aucune instance connue
        client.post().uri("/api/ai/conversations").exchange()
                .expectStatus().isEqualTo(503)
                .expectBody().json("{\"service\":\"AI-SERVICE\",\"message\":\"Service indisponible\"}", JsonCompareMode.STRICT);
    }

    @Test
    void the503KeepsCorsHeadersForTheFrontend() {
        client.get().uri("/api/legal/contrats").header(HttpHeaders.ORIGIN, "http://localhost:4200").exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200")
                .expectHeader().exists("X-Request-Id");
    }

    @Test
    void unknownPathIsStill404() {
        client.get().uri("/api/inconnu").exchange().expectStatus().isNotFound();
    }
}
