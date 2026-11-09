package com.launchpad.prevision.client;

import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ServiceIndisponible;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import feign.Feign;
import feign.Request;
import feign.Retryer;
import org.springframework.beans.factory.ObjectFactory;
import org.springframework.boot.autoconfigure.http.HttpMessageConverters;
import org.springframework.cloud.openfeign.support.ResponseEntityDecoder;
import org.springframework.cloud.openfeign.support.SpringDecoder;
import org.springframework.cloud.openfeign.support.SpringEncoder;
import org.springframework.cloud.openfeign.support.SpringMvcContract;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static com.launchpad.prevision.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le Document-Service est simulé par un vrai serveur HTTP local : on vérifie la requête émise et la dégradation
 * (service éteint, en erreur) sans dépendre d'un autre processus.
 */
class DocumentDistantFeignTest {

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

    /** Client Feign construit à la main (sans contexte Spring) : même contrat Spring MVC, URL fixe, timeout 2 s. */
    private DocumentDistantFeign client(String adresse) {
        ObjectFactory<HttpMessageConverters> convertisseurs =
                () -> new HttpMessageConverters(new MappingJackson2HttpMessageConverter());
        DocumentFeignClient feign = Feign.builder()
                .contract(new SpringMvcContract())
                .encoder(new SpringEncoder(convertisseurs))
                .decoder(new ResponseEntityDecoder(new SpringDecoder(convertisseurs)))
                .options(new Request.Options(2, TimeUnit.SECONDS, 2, TimeUnit.SECONDS, true))
                .retryer(Retryer.NEVER_RETRY)
                .target(DocumentFeignClient.class, adresse);
        return new DocumentDistantFeign(feign);
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
                .hasMessageContaining("indisponible")
                // Le message est renvoyé au modèle et au client : aucune adresse ni détail technique interne.
                .hasMessageNotContaining("localhost");
    }
}
