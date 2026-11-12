package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;

/**
 * Swagger UI unique de la plateforme (/docs) : accessible sans token même avec JWT_ENABLED=true,
 * et sa configuration liste la définition OpenAPI de chaque microservice, servie via la gateway.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT, properties = "launchpad.security.jwt-enabled=true")
@ActiveProfiles("local")
class UnifiedSwaggerTest extends GatewayTestSupport {

    @Test
    void docsRedirectsToSwaggerUiWithoutToken() {
        String location = client.get().uri("/docs").exchange()
                .expectStatus().is3xxRedirection()
                .returnResult(Void.class).getResponseHeaders().getFirst(HttpHeaders.LOCATION);
        assertThat(location).contains("swagger-ui/index.html");

        client.get().uri(location).exchange().expectStatus().isOk();
        // La page lit sa configuration (liste des services) sous /docs/gateway/api-docs/
        client.get().uri("/swagger-ui/swagger-initializer.js").exchange()
                .expectStatus().isOk()
                .expectBody(String.class).value(js -> assertThat(js).contains("/docs/gateway/api-docs/swagger-config"));
    }

    @Test
    void swaggerConfigListsEveryMicroservice() {
        String config = client.get().uri("/docs/gateway/api-docs/swagger-config").exchange()
                .expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();

        assertThat(config).contains(
                "/docs/user/schema/",
                "/api/market/secteurs/schema/", "/api/market/concurrents/schema/",
                "/api/market/etudes/schema/", "/api/market/swot/schema/",
                "/docs/ai/projet/schema/", "/docs/ai/recommandation/schema/", "/docs/ai/conversation/schema/",
                "/docs/finance/prevision/v3/api-docs", "/docs/finance/document/v3/api-docs",
                "/api/legal/docs-json", "/api/clauses/docs-json", "/api/commentaires/docs-json",
                "/docs/lawyer/client/v3/api-docs", "/docs/lawyer/message/v3/api-docs",
                "/docs/lawyer/docreview/v3/api-docs",
                "/api/comptable/docs.json");
    }

    @Test
    void schemaUrlsListedOnThePageArePublic() {
        // Une URL de la liste non publique donnerait 401 ; ici le service n'existe pas (503) :
        // la sécurité a donc laissé passer la requête jusqu'au routage.
        for (String path : new String[] {"/api/clauses/docs-json", "/api/commentaires/docs-json"}) {
            client.get().uri(path).exchange().expectStatus().value(status -> assertThat(status).isNotEqualTo(401));
        }
    }
}
