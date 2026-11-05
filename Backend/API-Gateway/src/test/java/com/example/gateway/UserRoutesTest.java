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
 * User-Service (Django + Keycloak) : /api/auth/** arrive tel quel, et les docs drf-spectacular
 * (servies sous /api/docs/, /api/redoc/, /api/schema/) sont exposées sous /docs/user/.
 * Le faux service répond {"service": "user", "chemin": "<chemin>"}.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@ActiveProfiles("local")
class UserRoutesTest extends GatewayTestSupport {

    static final MockService user = new MockService(request -> MockService.json(200,
            "{\"service\":\"user\",\"chemin\":\"" + request.getPath() + "\"}"));

    @DynamicPropertySource
    static void services(DynamicPropertyRegistry registry) {
        registry.add("launchpad.services.user.uri", user::url);
    }

    @BeforeEach
    void clear() {
        user.clear();
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({
            "/api/auth/register/",
            "/api/auth/login/",
            "/api/auth/refresh/",
            "/api/auth/logout/",
            "/api/auth/profile/",
            "/api/auth/health/",
            "/api/auth/lawyers/",
    })
    void authPathsReachUserServiceUnchanged(String path) {
        client.post().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"user\",\"chemin\":\"" + path + "\"}", JsonCompareMode.STRICT);
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "/docs/user/docs/, /api/docs/",
            "/docs/user/redoc/, /api/redoc/",
            "/docs/user/schema/, /api/schema/",
            "/docs/user/schema/?format=json, /api/schema/?format=json",
    })
    void docsAreRewrittenToTheServiceDocs(String path, String servicePath) {
        client.get().uri(path).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"user\",\"chemin\":\"" + servicePath + "\"}", JsonCompareMode.STRICT);
    }

    /** Les pages Swagger UI et ReDoc chargent /api/schema/ : le Referer désigne le User-Service. */
    @ParameterizedTest(name = "Referer {0}")
    @CsvSource({
            "http://localhost:8090/docs/user/docs/",
            "http://localhost:8090/docs/user/redoc/",
    })
    void swaggerUiSchemaRequestFollowsTheReferer(String referer) {
        client.get().uri("/api/schema/").header(HttpHeaders.REFERER, referer).exchange()
                .expectStatus().isOk()
                .expectBody().json("{\"service\":\"user\",\"chemin\":\"/api/schema/\"}", JsonCompareMode.STRICT);
    }

    @Test
    void rootSchemaWithoutUserRefererIsNotRouted() {
        client.get().uri("/api/schema/").exchange().expectStatus().isNotFound();
    }

    @Test
    void theOldUsersPrefixNoLongerExists() {
        client.get().uri("/api/users/1").exchange().expectStatus().isNotFound();
    }
}
