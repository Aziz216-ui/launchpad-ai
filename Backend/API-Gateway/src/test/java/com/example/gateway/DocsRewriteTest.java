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

/**
 * Docs servies hors préfixe par le juridique : exposées sous /docs/... par réécriture.
 * Les docs avocat (4 services) sont testées dans LawyerRoutesTest.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class DocsRewriteTest extends GatewayTestSupport {

    static final MockService legal = MockService.echo();

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.legal.uri", legal::url);
    }

    @BeforeEach
    void clear() {
        legal.clear();
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
