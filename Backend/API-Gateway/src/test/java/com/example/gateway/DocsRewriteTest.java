package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Docs servies hors préfixe par l'avocat et le juridique : exposées sous /docs/... par réécriture. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class DocsRewriteTest extends GatewayTestSupport {

    static final MockService lawyer = MockService.echo();
    static final MockService legal = MockService.echo();

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.lawyer.uri", lawyer::url);
        registry.add("launchpad.services.legal.uri", legal::url);
    }

    @BeforeEach
    void clear() {
        lawyer.clear();
        legal.clear();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/docs/lawyer/swagger-ui/index.html, /swagger-ui/index.html",
            "/docs/lawyer/swagger-ui/swagger-ui.css, /swagger-ui/swagger-ui.css",
            "/docs/lawyer/v3/api-docs, /v3/api-docs",
            "/docs/lawyer/v3/api-docs/swagger-config, /v3/api-docs/swagger-config",
            "/api/lawyer/dossiers?page=2, /api/lawyer/dossiers?page=2",
    })
    void lawyerDocs(String gatewayPath, String servicePath) {
        client.get().uri(gatewayPath).exchange().expectStatus().isOk();
        assertThat(lawyer.lastRequest().getPath()).isEqualTo(servicePath);
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/docs/legal, /api/docs",
            "/docs/legal/, /api/docs/",
            "/docs/legal/swagger-ui-init.js, /api/docs/swagger-ui-init.js",
            "/docs/legal-json, /api/docs-json",
            "/api/legal/contrats/3, /api/legal/contrats/3",
    })
    void legalDocs(String gatewayPath, String servicePath) {
        client.get().uri(gatewayPath).exchange().expectStatus().isOk();
        assertThat(legal.lastRequest().getPath()).isEqualTo(servicePath);
    }
}
