package com.example.gateway;

import static org.assertj.core.api.Assertions.assertThat;

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
 * Co-Fondateur IA découpé en 3 microservices : chaque chemin /api/ai/... arrive au bon service,
 * et les docs (même chemin /api/ai/docs/ dans les 3 services) sont séparées sous /docs/ai/<service>/.
 * Chaque faux service répond {"service": "<nom>", "chemin": "<chemin>"}.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class AiRoutesTest extends GatewayTestSupport {

    static final MockService projet = named("projet");
    static final MockService recommandation = named("recommandation");
    static final MockService conversation = named("conversation");

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.projet.uri", projet::url);
        registry.add("launchpad.services.recommandation.uri", recommandation::url);
        registry.add("launchpad.services.conversation.uri", conversation::url);
    }

    @BeforeEach
    void clear() {
        projet.clear();
        recommandation.clear();
        conversation.clear();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/api/ai/projets/, projet",
            "/api/ai/projets/3/, projet",
            "/api/ai/projets/3/analyser/, projet",
            "/api/ai/analyses/, projet",
            "/api/ai/analyses/4/, projet",
            "/api/ai/health/, projet",
            "/api/ai/docs/, projet",
            "/api/ai/schema/, projet",
            "/api/ai/recommandations/, recommandation",
            "/api/ai/recommandations/?projet_id=1, recommandation",
            "/api/ai/recommandations/5/statut/, recommandation",
            "/api/ai/recommandations/generer/, recommandation",
            "/api/ai/conversations/, conversation",
            "/api/ai/conversations/2/, conversation",
            "/api/ai/conversations/2/messages/, conversation",
    })
    void eachPathReachesItsService(String path, String service) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.service").isEqualTo(service);
    }

    @ParameterizedTest(name = "{0} -> {1} {2}")
    @CsvSource({
            "/docs/ai/projet/docs/, projet, /api/ai/docs/",
            "/docs/ai/projet/schema/, projet, /api/ai/schema/",
            "/docs/ai/recommandation/docs/, recommandation, /api/ai/docs/",
            "/docs/ai/recommandation/schema/?format=json, recommandation, /api/ai/schema/?format=json",
            "/docs/ai/conversation/docs/, conversation, /api/ai/docs/",
            "/docs/ai/conversation/schema/, conversation, /api/ai/schema/",
    })
    void docsAreRewrittenToTheServiceDocs(String path, String service, String servicePath) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"" + servicePath + "\"}",
                        JsonCompareMode.STRICT);
    }

    /** La page Swagger UI de chaque service charge /api/ai/schema/ : le Referer désigne le bon service. */
    @ParameterizedTest(name = "Referer {0} -> {1}")
    @CsvSource({
            "http://localhost:8090/docs/ai/projet/docs/, projet",
            "http://localhost:8090/docs/ai/recommandation/docs/, recommandation",
            "http://localhost:8090/docs/ai/conversation/docs/, conversation",
            "http://localhost:4200/co-fondateur-ia, projet",
    })
    void swaggerUiSchemaRequestFollowsTheReferer(String referer, String service) {
        client.get().uri("/api/ai/schema/").header(HttpHeaders.REFERER, referer).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"" + service + "\",\"chemin\":\"/api/ai/schema/\"}",
                        JsonCompareMode.STRICT);
    }

    @Test
    void messageIsPostedToConversationServiceWithThePathUnchanged() {
        client.post().uri("/api/ai/conversations/2/messages/").exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"conversation\",\"chemin\":\"/api/ai/conversations/2/messages/\"}",
                        JsonCompareMode.STRICT);
        assertThat(projet.lastRequest()).as("PROJET-SERVICE ne doit pas recevoir le message").isNull();
    }

    @Test
    void theOldSingleAiRouteNoLongerExists() {
        client.get().uri("/api/ai/inconnu/").exchange().expectStatus().isNotFound();
    }

    private static MockService named(String name) {
        return new MockService(request -> MockService.json(200,
                "{\"service\":\"" + name + "\",\"chemin\":\"" + request.getPath() + "\"}"));
    }
}
