package com.example.gateway;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;

/**
 * Espace avocat découpé en 3 microservices : chaque chemin /api/lawyer/... arrive au bon service,
 * et les docs springdoc (même chemin dans les 3 services) sont séparées sous /docs/lawyer/<service>/.
 * Chaque faux service répond {"service": "<nom>", "chemin": "<chemin>"}.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class LawyerRoutesTest extends GatewayTestSupport {

    static final MockService clientService = named("client");
    static final MockService message = named("message");
    static final MockService docreview = named("docreview");

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.lawyer-client.uri", clientService::url);
        registry.add("launchpad.services.lawyer-message.uri", message::url);
        registry.add("launchpad.services.lawyer-docreview.uri", docreview::url);
    }

    @BeforeEach
    void clear() {
        clientService.clear();
        message.clear();
        docreview.clear();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/api/lawyer/clients, client",
            "/api/lawyer/clients/7, client",
            "/api/lawyer/clients/7/archive, client",
            "/api/lawyer/messages, message",
            "/api/lawyer/messages/7, message",
            "/api/lawyer/messages/detail/3, message",
            "/api/lawyer/messages/unread-count, message",
            "/api/lawyer/communication/messages, message",
            "/api/lawyer/reviews, docreview",
            "/api/lawyer/reviews/4/comments, docreview",
            "/api/lawyer/document-reviews/4/decision, docreview",
    })
    void eachPathReachesItsServiceUnchanged(String path, String service) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"" + path + "\"}",
                        JsonCompareMode.STRICT);
    }

    @ParameterizedTest(name = "{0} -> {1} {2}")
    @CsvSource({
            "/docs/lawyer/client/swagger-ui/index.html, client, /swagger-ui/index.html",
            "/docs/lawyer/client/v3/api-docs, client, /v3/api-docs",
            "/docs/lawyer/message/swagger-ui/swagger-ui.css, message, /swagger-ui/swagger-ui.css",
            "/docs/lawyer/message/v3/api-docs/swagger-config, message, /v3/api-docs/swagger-config",
            "/docs/lawyer/docreview/swagger-ui/index.html, docreview, /swagger-ui/index.html",
            "/docs/lawyer/docreview/v3/api-docs, docreview, /v3/api-docs",
    })
    void docsAreRewrittenToTheServiceDocs(String path, String service, String servicePath) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"" + servicePath + "\"}",
                        JsonCompareMode.STRICT);
    }

    /** La page Swagger UI charge /v3/api-docs/swagger-config puis /v3/api-docs : le Referer désigne le service. */
    @ParameterizedTest(name = "Referer {0} -> {1}")
    @CsvSource({
            "http://localhost:8090/docs/lawyer/client/swagger-ui/index.html, client",
            "http://localhost:8090/docs/lawyer/message/swagger-ui/index.html, message",
            "http://localhost:8090/docs/lawyer/docreview/swagger-ui/index.html, docreview",
    })
    void swaggerUiSchemaRequestFollowsTheReferer(String referer, String service) {
        client.get().uri("/v3/api-docs/swagger-config").header(HttpHeaders.REFERER, referer).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"/v3/api-docs/swagger-config\"}",
                        JsonCompareMode.STRICT);
    }

    @Test
    void rootApiDocsWithoutLawyerRefererIsNotRouted() {
        client.get().uri("/v3/api-docs").exchange().expectStatus().isNotFound();
    }

    @Test
    void unknownLawyerResourceIsNotRouted() {
        client.get().uri("/api/lawyer/dossiers").exchange().expectStatus().isNotFound();
    }

    private static MockService named(String name) {
        return new MockService(request -> MockService.json(200,
                "{\"service\":\"" + name + "\",\"chemin\":\"" + request.getPath() + "\"}"));
    }
}
