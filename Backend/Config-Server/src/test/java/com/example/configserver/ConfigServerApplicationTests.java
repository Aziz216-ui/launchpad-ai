package com.example.configserver;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Le Config Server démarre (sans Eureka) et sert la configuration de config-repo/ :
 * fichier commun + fichier propre à l'API Gateway.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "eureka.client.enabled=false",
                "spring.cloud.config.server.native.search-locations=file:./config-repo/",
        })
class ConfigServerApplicationTests {

    @LocalServerPort
    int port;

    private String get(String chemin) throws Exception {
        HttpResponse<String> reponse = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + chemin)).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(reponse.statusCode()).isEqualTo(200);
        return reponse.body();
    }

    @Test
    void sertLaConfigurationDeLaGateway() throws Exception {
        String config = get("/API-GATEWAY/default");
        assertThat(config).contains("API-GATEWAY.yml", "application.yml");
        assertThat(config).contains("spring.cloud.gateway.server.webflux.httpclient.response-timeout");
        assertThat(config).contains("\"launchpad.configuration.source\":\"config-server\"");
    }

    @Test
    void sertLaConfigurationCommuneATouteApplication() throws Exception {
        String config = get("/AUTRE-SERVICE/default");
        assertThat(config).contains("application.yml").doesNotContain("API-GATEWAY.yml");
        assertThat(config).contains("eureka.client.registry-fetch-interval-seconds");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "prevision-service", "document-service",
            "lawyer-client-service", "lawyer-message-service", "lawyer-docreview-service"})
    void sertLaConfigurationDesServicesFinanceEtAvocat(String service) throws Exception {
        String config = get("/" + service + "/default");
        assertThat(config).contains(service + ".yml", "application.yml");
        assertThat(config).contains("\"launchpad.configuration.service\":\"" + service + "\"");
    }

    @Test
    void healthCheck() throws Exception {
        assertThat(get("/actuator/health")).contains("\"status\":\"UP\"");
    }

}
