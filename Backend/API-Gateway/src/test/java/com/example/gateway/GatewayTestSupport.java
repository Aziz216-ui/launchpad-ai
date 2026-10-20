package com.example.gateway;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.web.reactive.server.WebTestClient;

/** Client HTTP branché sur la gateway démarrée par @SpringBootTest(RANDOM_PORT). */
abstract class GatewayTestSupport {

    @LocalServerPort
    int port;

    WebTestClient client;

    @BeforeEach
    void createClient() {
        client = WebTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }
}
