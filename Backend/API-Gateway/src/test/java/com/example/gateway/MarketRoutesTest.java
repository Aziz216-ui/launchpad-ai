package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.json.JsonCompareMode;

/**
 * Étude de marché découpée en 4 microservices : chaque chemin /api/market/... arrive au bon
 * service, sans réécriture. Chaque faux service répond {"service": "<nom>", "chemin": "<chemin>"}.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class MarketRoutesTest extends GatewayTestSupport {

    static final MockService secteur = named("secteur");
    static final MockService concurrent = named("concurrent");
    static final MockService etude = named("etude");
    static final MockService swot = named("swot");

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.secteur.uri", secteur::url);
        registry.add("launchpad.services.concurrent.uri", concurrent::url);
        registry.add("launchpad.services.etude.uri", etude::url);
        registry.add("launchpad.services.swot.uri", swot::url);
    }

    @BeforeEach
    void clear() {
        secteur.clear();
        concurrent.clear();
        etude.clear();
        swot.clear();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/api/market/secteurs/, secteur",
            "/api/market/secteurs/3/, secteur",
            "/api/market/secteurs/health/, secteur",
            "/api/market/tendances/?secteur=1, secteur",
            "/api/market/analyse/secteur/1/, secteur",
            "/api/market/concurrents/?secteur=1&pays=Tunisie, concurrent",
            "/api/market/concurrents/5/, concurrent",
            "/api/market/swot/?etude=2, swot",
            "/api/market/swot/etude/2/, swot",
            "/api/market/etudes/2/generer-swot/, swot",
            "/api/market/etudes/, etude",
            "/api/market/etudes/2/, etude",
            "/api/market/etudes/2/rapport/, etude",
            "/api/market/etudes/2/rapport/pdf/, etude",
            "/api/market/etudes/2/comparaison-prix/, etude",
            "/api/market/personas/?etude=2, etude",
            "/api/market/analyse/projet/1/, etude",
            "/api/market/secteurs/docs/, secteur",
            "/api/market/concurrents/schema/, concurrent",
            "/api/market/etudes/docs/, etude",
            "/api/market/swot/docs/, swot",
    })
    void eachPathReachesItsService(String path, String service) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.service").isEqualTo(service);
    }

    @Test
    void generationOfTheSwotIsPostedToSwotServiceWithThePathUnchanged() {
        client.post().uri("/api/market/etudes/7/generer-swot/").exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"swot\",\"chemin\":\"/api/market/etudes/7/generer-swot/\"}",
                        JsonCompareMode.STRICT);
        assertThat(etude.lastRequest()).as("ETUDE-SERVICE ne doit pas recevoir la génération").isNull();
    }

    @Test
    void theOldSingleMarketRouteNoLongerExists() {
        client.get().uri("/api/market/docs/").exchange().expectStatus().isNotFound();
    }

    private static MockService named(String name) {
        return new MockService(request -> MockService.json(200,
                "{\"service\":\"" + name + "\",\"chemin\":\"" + request.getPath() + "\"}"));
    }
}
