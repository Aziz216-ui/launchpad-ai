package com.launchpad.prevision.client;

import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ServiceIndisponible;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static com.launchpad.prevision.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Le Document-Service est simulé par un vrai serveur HTTP local : on vérifie la requête émise et la dégradation
 * (service éteint, en erreur) sans dépendre d'un autre processus.
 */
class DocumentDistantRestTest {

    private final DiscoveryClient eureka = mock(DiscoveryClient.class);
    private HttpServer serveur;

    @BeforeEach
    void demarrerServeur() throws IOException {
        serveur = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        serveur.start();
    }

    @AfterEach
    void arreterServeur() {
        serveur.stop(0);
    }

    private String adresseServeur() {
        return "http://localhost:" + serveur.getAddress().getPort();
    }

    private DocumentDistantRest client(String adresseSecours) {
        return new DocumentDistantRest(new ResolveurService(eureka), "document-service", adresseSecours,
                Duration.ofSeconds(2));
    }

    private void repondre(int statut, String corps) {
        serveur.createContext("/api/finance/documents", echange -> {
            byte[] octets = corps.getBytes(StandardCharsets.UTF_8);
            echange.getResponseHeaders().add("Content-Type", "application/json");
            echange.sendResponseHeaders(statut, octets.length);
            echange.getResponseBody().write(octets);
            echange.close();
        });
    }

    @Test
    void demande_la_generation_au_document_service_et_renvoie_l_identifiant() {
        UUID documentId = UUID.randomUUID();
        AtomicReference<String> corpsRecu = new AtomicReference<>();
        serveur.createContext("/api/finance/documents", echange -> {
            corpsRecu.set(new String(echange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] octets = ("{\"documentId\":\"" + documentId + "\"}").getBytes(StandardCharsets.UTF_8);
            echange.getResponseHeaders().add("Content-Type", "application/json");
            echange.sendResponseHeaders(201, octets.length);
            echange.getResponseBody().write(octets);
            echange.close();
        });

        UUID resultat = client(adresseServeur()).genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN);

        assertThat(resultat).isEqualTo(documentId);
        assertThat(corpsRecu.get()).contains(PROJET_ID.toString()).contains("BUSINESS_PLAN");
    }

    @Test
    void prefere_l_adresse_donnee_par_eureka_a_l_adresse_de_secours() {
        ServiceInstance instance = mock(ServiceInstance.class);
        when(instance.getUri()).thenReturn(URI.create(adresseServeur()));
        when(eureka.getInstances("document-service")).thenReturn(List.of(instance));
        UUID documentId = UUID.randomUUID();
        repondre(201, "{\"documentId\":\"" + documentId + "\"}");

        assertThat(client("http://adresse-inutilisee.invalid").genererDocument(PROJET_ID, TypeDocument.PLAN_TRESORERIE))
                .isEqualTo(documentId);
    }

    @Test
    void erreur_http_du_document_service_devient_service_indisponible() {
        repondre(500, "{}");

        assertThatThrownBy(() -> client(adresseServeur()).genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN))
                .isInstanceOf(ServiceIndisponible.class);
    }

    @Test
    void reponse_sans_identifiant_devient_service_indisponible() {
        repondre(201, "{}");

        assertThatThrownBy(() -> client(adresseServeur()).genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN))
                .isInstanceOf(ServiceIndisponible.class);
    }

    @Test
    void service_eteint_ne_plante_pas_et_devient_service_indisponible() throws IOException {
        int portLibre;
        try (ServerSocket socket = new ServerSocket(0)) {
            portLibre = socket.getLocalPort();
        }

        assertThatThrownBy(() -> client("http://localhost:" + portLibre)
                .genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN))
                .isInstanceOf(ServiceIndisponible.class)
                .hasMessageContaining("indisponible");
    }
}
