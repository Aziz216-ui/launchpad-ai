package com.launchpad.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bout en bout : serveur HTTP réel, PostgreSQL (Testcontainers) migré par Flyway, stockage disque (profil dev).
 * Le Prevision-Service est simulé par un serveur HTTP local qui répond à la synthèse d'un projet
 * (CA 120 000 puis 144 000, dépenses 70 000 par an). Rejoue les scénarios 3 et 4.
 */
// Pas de RabbitMQ pendant les tests (CI) : son indicateur de santé passerait /actuator/health à DOWN.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "finance.stockage.local.repertoire=target/test-documents",
        "spring.rabbitmq.listener.simple.auto-startup=false",
        "management.health.rabbit.enabled=false",
        "eureka.client.enabled=false" })
@Import(TestcontainersConfiguration.class)
class DocumentServiceIntegrationTest {

    private static final Long PROJET_ID = 1L;
    private static final Long PROJET_SANS_PREVISION = 999L;

    private static final String SYNTHESE_JSON = """
            {"prevision":{"previsionId":"22222222-2222-2222-2222-222222222222","periode":"2026",
              "chiffreAffaires":100000.00,"coutsDirects":40000.00,"depenses":70000.00,"resultat":30000.00,
              "projections":[{"annee":1,"chiffreAffaires":120000.00,"depenses":70000.00,"marge":50000.00},
                             {"annee":2,"chiffreAffaires":144000.00,"depenses":70000.00,"marge":74000.00}]},
             "marges":{"margeBrute":60000.00,"margeNette":30000.00,"tauxMargeBrute":60.00,"tauxMargeNette":30.00},
             "ecart":{"montant":30000.00,"pourcentage":30.00,"statut":"EXCEDENT"}}
            """;

    private static HttpServer previsionService;

    @BeforeAll
    static void demarrerPrevisionService() throws IOException {
        previsionService = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        previsionService.createContext("/api/finance/projets/", echange -> {
            boolean connu = echange.getRequestURI().getPath().contains(PROJET_ID.toString());
            byte[] octets = (connu ? SYNTHESE_JSON : "{}").getBytes(StandardCharsets.UTF_8);
            echange.getResponseHeaders().add("Content-Type", "application/json");
            echange.sendResponseHeaders(connu ? 200 : 404, octets.length);
            echange.getResponseBody().write(octets);
            echange.close();
        });
        previsionService.start();
    }

    @AfterAll
    static void arreterPrevisionService() {
        previsionService.stop(0);
    }

    @DynamicPropertySource
    static void adressePrevisionService(DynamicPropertyRegistry registre) {
        registre.add("finance.prevision-service.url",
                () -> "http://localhost:" + previsionService.getAddress().getPort());
    }

    @Autowired
    private TestRestTemplate http;

    @Value("${finance.stockage.local.repertoire}")
    private Path repertoireDocuments;

    private ResponseEntity<JsonNode> post(String url, Object corps) {
        return http.postForEntity("/api/finance" + url, corps, JsonNode.class);
    }

    private ResponseEntity<JsonNode> get(String url) {
        return http.getForEntity("/api/finance" + url, JsonNode.class);
    }

    @Test
    void scenarios_3_et_4_de_bout_en_bout() {
        // Scénario 3 : plan de trésorerie (trésorerie initiale 10 000).
        ResponseEntity<JsonNode> document = post("/documents",
                Map.of("projetId", PROJET_ID, "type", "PLAN_TRESORERIE", "tresorerieInitiale", 10000));
        assertThat(document.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String documentId = document.getBody().get("documentId").asText();
        JsonNode plan = get("/documents/" + documentId).getBody().get("contenu").get("sections").get(1);
        assertThat(plan.get("lignes").get(1).get("valeurs").get(3).decimalValue()).isEqualByComparingTo("134000");
        assertThat(get("/projets/" + PROJET_ID + "/documents").getBody()).hasSize(1);

        // Scénario 4 : export PDF et Excel, puis suppression du document et de ses fichiers.
        ResponseEntity<byte[]> pdf = http.getForEntity("/api/finance/documents/" + documentId + "/export?format=pdf",
                byte[].class);
        assertThat(pdf.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pdf.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(pdf.getHeaders().getContentDisposition().getFilename())
                .isEqualTo("plan-tresorerie-" + documentId + ".pdf");
        assertThat(new String(pdf.getBody(), 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");
        ResponseEntity<byte[]> xlsx = http.getForEntity("/api/finance/documents/" + documentId + "/export?format=xlsx",
                byte[].class);
        assertThat(xlsx.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(repertoireDocuments.resolve(documentId + ".pdf")).exists();
        assertThat(repertoireDocuments.resolve(documentId + ".xlsx")).exists();

        ResponseEntity<Void> suppression = http.exchange("/api/finance/documents/" + documentId, HttpMethod.DELETE,
                null, Void.class);
        assertThat(suppression.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(repertoireDocuments.resolve(documentId + ".pdf")).doesNotExist();
        assertThat(repertoireDocuments.resolve(documentId + ".xlsx")).doesNotExist();
        ResponseEntity<JsonNode> introuvable = get("/documents/" + documentId);
        assertThat(introuvable.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(introuvable.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON);
    }

    @Test
    void projet_sans_prevision_renvoie_404() {
        ResponseEntity<JsonNode> reponse = post("/documents",
                Map.of("projetId", PROJET_SANS_PREVISION, "type", "BUSINESS_PLAN"));

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void openapi_swagger_et_sante_sont_exposes() {
        ResponseEntity<String> apiDocs = http.getForEntity("/v3/api-docs", String.class);
        assertThat(apiDocs.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(apiDocs.getBody()).contains("/api/finance/documents", "/api/finance/documents/{id}/export");
        assertThat(http.getForEntity("/swagger-ui/index.html", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(http.getForEntity("/actuator/health", String.class).getBody()).contains("\"UP\"");
    }
}
