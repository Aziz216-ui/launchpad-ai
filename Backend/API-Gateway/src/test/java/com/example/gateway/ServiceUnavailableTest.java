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

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.SocketPolicy;

/** Service éteint ou absent d'Eureka : 503 {"service": "<NOM>", "message": "Service indisponible"}. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class ServiceUnavailableTest extends GatewayTestSupport {

    /** Accepte la connexion puis la coupe sans répondre (port publié d'un conteneur Docker arrêté). */
    static final MockService stopping = new MockService(
            request -> new MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST));

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        String closed = MockService.closedPortUrl();
        registry.add("launchpad.services.legal.uri", () -> closed);
        registry.add("launchpad.services.lawyer-client.uri", () -> closed);
        registry.add("launchpad.services.secteur.uri", stopping::url);
        // Route en lb:// alors qu'Eureka est coupé (profil local) : aucune instance connue
        registry.add("launchpad.services.user.uri", () -> "lb://user-service");
    }

    @Test
    void directUrlWithNothingListeningGives503Json() {
        client.get().uri("/api/legal/contrats").exchange()
                .expectStatus().isEqualTo(503)
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .expectBody().json("{\"service\":\"LEGAL-SERVICE\",\"message\":\"Service indisponible\"}", JsonCompareMode.STRICT);
    }

    @Test
    void connectionClosedBeforeAnyResponseGives503Json() {
        client.get().uri("/api/market/secteurs/").exchange()
                .expectStatus().isEqualTo(503)
                .expectBody().json("{\"service\":\"SECTEUR-SERVICE\",\"message\":\"Service indisponible\"}", JsonCompareMode.STRICT);
    }

    @Test
    void lowercaseEurekaNameIsKeptInTheMessage() {
        client.get().uri("/api/lawyer/clients").exchange()
                .expectStatus().isEqualTo(503)
                .expectBody().jsonPath("$.service").isEqualTo("lawyer-client-service");
    }

    @Test
    void loadBalancedRouteWithoutInstanceGives503Json() {
        client.post().uri("/api/auth/login").exchange()
                .expectStatus().isEqualTo(503)
                .expectBody().json("{\"service\":\"user-service\",\"message\":\"Service indisponible\"}", JsonCompareMode.STRICT);
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
