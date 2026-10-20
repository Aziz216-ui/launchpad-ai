package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import okhttp3.mockwebserver.RecordedRequest;

/** Profil local : relais vers un faux Market-Service, sans réécriture du chemin. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class ProxyTest extends GatewayTestSupport {

    // Le faux service renvoie lui-même un en-tête CORS : la gateway ne doit en garder qu'un
    static final MockService market = new MockService(request -> MockService
            .json(200, "[{\"id\":1,\"titre\":\"Paiement mobile pour PME\"}]")
            .addHeader("Access-Control-Allow-Origin", "http://localhost:4200"));

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.market.uri", market::url);
    }

    @BeforeEach
    void clear() {
        market.clear();
    }

    @Test
    void forwardsPathQueryAndAuthorizationUnchanged() {
        client.get().uri("/api/market/etudes/?statut=brouillon")
                .header(HttpHeaders.AUTHORIZATION, "Bearer un-token-quelconque")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$[0].titre").isEqualTo("Paiement mobile pour PME");

        RecordedRequest received = market.lastRequest();
        assertThat(received.getPath()).isEqualTo("/api/market/etudes/?statut=brouillon");
        assertThat(received.getHeader(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer un-token-quelconque");
    }

    @Test
    void addsRequestIdAndSendsItToTheService() {
        String id = client.get().uri("/api/market/etudes/").exchange()
                .expectStatus().isOk()
                .expectHeader().exists("X-Request-Id")
                .returnResult(String.class).getResponseHeaders().getFirst("X-Request-Id");

        assertThat(id).isNotBlank();
        assertThat(market.lastRequest().getHeader("X-Request-Id")).isEqualTo(id);
    }

    @Test
    void keepsTheRequestIdSentByTheClient() {
        client.get().uri("/api/market/etudes/").header("X-Request-Id", "front-123").exchange()
                .expectHeader().valueEquals("X-Request-Id", "front-123");
        assertThat(market.lastRequest().getHeader("X-Request-Id")).isEqualTo("front-123");
    }

    @Test
    void corsHeadersAreAddedOnceForTheFrontend() {
        client.get().uri("/api/market/etudes/")
                .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valuesMatch(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200");
    }

    @Test
    void corsPreflightIsAnsweredByTheGateway() {
        client.options().uri("/api/market/etudes/1/")
                .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PATCH")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().valueEquals(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200")
                .expectHeader().value(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, m -> assertThat(m).contains("PATCH"));

        assertThat(market.lastRequest()).as("le préflight ne doit pas atteindre le service").isNull();
    }

    @Test
    void otherOriginsAreRejected() {
        client.get().uri("/api/market/etudes/")
                .header(HttpHeaders.ORIGIN, "http://site-inconnu.example")
                .exchange()
                .expectStatus().isForbidden();
    }
}
