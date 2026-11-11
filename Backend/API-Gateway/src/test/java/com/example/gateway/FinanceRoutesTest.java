package com.example.gateway;

import org.junit.jupiter.api.BeforeEach;
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
 * Finance découpée en 2 microservices : chaque chemin /api/finance/... arrive au bon service (documents et
 * notifications au Document-Service, le reste au Prevision-Service), et les docs springdoc des deux services sont
 * séparées sous /docs/finance/<service>/. Chaque faux service répond {"service": "<nom>", "chemin": "<chemin>"}.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class FinanceRoutesTest extends GatewayTestSupport {

    static final MockService prevision = named("prevision");
    static final MockService document = named("document");

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.prevision.uri", prevision::url);
        registry.add("launchpad.services.document.uri", document::url);
    }

    @BeforeEach
    void clear() {
        prevision.clear();
        document.clear();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/api/finance/previsions, prevision",
            "/api/finance/previsions/42/avis, prevision",
            "/api/finance/projets/7/previsions, prevision",
            "/api/finance/projets/7/acces, prevision",
            "/api/finance/projets/7/financiers, prevision",
            "/api/finance/mes-projets, prevision",
            "/api/finance/documents, document",
            "/api/finance/documents/42/certification, document",
            "/api/finance/projets/7/documents, document",
            "/api/finance/projets/7/notifications, document",
    })
    void eachPathReachesItsServiceUnchanged(String path, String service) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"" + path + "\"}",
                        JsonCompareMode.STRICT);
    }

    @ParameterizedTest(name = "{0} -> {1} {2}")
    @CsvSource({
            "/docs/finance/prevision/swagger-ui/index.html, prevision, /swagger-ui/index.html",
            "/docs/finance/prevision/v3/api-docs, prevision, /v3/api-docs",
            "/docs/finance/document/swagger-ui/index.html, document, /swagger-ui/index.html",
            "/docs/finance/document/v3/api-docs/swagger-config, document, /v3/api-docs/swagger-config",
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
            "http://localhost:8090/docs/finance/prevision/swagger-ui/index.html, prevision",
            "http://localhost:8090/docs/finance/document/swagger-ui/index.html, document",
    })
    void swaggerUiSchemaRequestFollowsTheReferer(String referer, String service) {
        client.get().uri("/v3/api-docs").header(HttpHeaders.REFERER, referer).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"/v3/api-docs\"}",
                        JsonCompareMode.STRICT);
    }

    private static MockService named(String name) {
        return new MockService(request -> MockService.json(200,
                "{\"service\":\"" + name + "\",\"chemin\":\"" + request.getPath() + "\"}"));
    }
}
