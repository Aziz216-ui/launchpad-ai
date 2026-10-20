package com.launchpad.finance;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bout en bout : serveur HTTP réel, PostgreSQL (Testcontainers) migré par Flyway, stockage disque (profil dev).
 * Rejoue les 4 scénarios runtime dans l'ordre.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "finance.stockage.local.repertoire=target/test-documents")
@Import(TestcontainersConfiguration.class)
class FinanceServiceIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    @Value("${finance.stockage.local.repertoire}")
    private Path repertoireDocuments;

    private final UUID projetId = UUID.randomUUID();

    private ResponseEntity<JsonNode> post(String url, Object corps) {
        return http.postForEntity("/api/finance" + url, corps, JsonNode.class);
    }

    private ResponseEntity<JsonNode> get(String url) {
        return http.getForEntity("/api/finance" + url, JsonNode.class);
    }

    @Test
    void scenarios_1_a_4_de_bout_en_bout() {
        // Scénario 1 : prévision, marges, écart.
        ResponseEntity<JsonNode> creation = post("/previsions", Map.of("projetId", projetId, "periode", "2026",
                "chiffreAffaires", 100000, "coutsDirects", 40000, "depenses", 70000));
        assertThat(creation.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String previsionId = creation.getBody().get("previsionId").asText();
        assertThat(creation.getHeaders().getLocation()).hasToString(
                http.getRootUri() + "/api/finance/previsions/" + previsionId);
        assertThat(creation.getBody().get("resultat").decimalValue()).isEqualByComparingTo("30000");

        JsonNode marges = get("/previsions/" + previsionId + "/marges").getBody();
        assertThat(marges.get("tauxMargeBrute").decimalValue()).isEqualByComparingTo("60");
        assertThat(marges.get("margeNette").decimalValue()).isEqualByComparingTo("30000");
        assertThat(get("/previsions/" + previsionId + "/ecart").getBody().get("statut").asText()).isEqualTo("EXCEDENT");
        assertThat(get("/projets/" + projetId + "/previsions").getBody()).hasSize(1);

        // Scénario 2 : projections, puis remplacement.
        ResponseEntity<JsonNode> projections = post("/previsions/" + previsionId + "/projections",
                Map.of("tauxCa", 10, "tauxDepenses", 5, "horizon", 3));
        assertThat(projections.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(projections.getBody().get(2).get("chiffreAffaires").decimalValue()).isEqualByComparingTo("133100");
        post("/previsions/" + previsionId + "/projections", Map.of("tauxCa", 20, "tauxDepenses", 0, "horizon", 2));
        JsonNode remplacees = get("/previsions/" + previsionId + "/projections").getBody();
        assertThat(remplacees).hasSize(2);
        assertThat(remplacees.get(1).get("chiffreAffaires").decimalValue()).isEqualByComparingTo("144000");

        // Scénario 3 : plan de trésorerie (CA 120 000 / 144 000, dépenses 70 000, trésorerie initiale 10 000).
        ResponseEntity<JsonNode> document = post("/documents",
                Map.of("projetId", projetId, "type", "PLAN_TRESORERIE", "tresorerieInitiale", 10000));
        assertThat(document.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String documentId = document.getBody().get("documentId").asText();
        JsonNode plan = get("/documents/" + documentId).getBody().get("contenu").get("sections").get(1);
        assertThat(plan.get("lignes").get(1).get("valeurs").get(3).decimalValue()).isEqualByComparingTo("134000");
        assertThat(get("/projets/" + projetId + "/documents").getBody()).hasSize(1);

        // Scénario 4 : export PDF et Excel, puis suppression du document et de ses fichiers.
        ResponseEntity<byte[]> pdf = http.getForEntity("/api/finance/documents/" + documentId + "/export?format=pdf",
                byte[].class);
        assertThat(pdf.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(pdf.getHeaders().getContentType()).isEqualTo(MediaType.APPLICATION_PDF);
        assertThat(pdf.getHeaders().getContentDisposition().getFilename()).isEqualTo("plan-tresorerie-" + documentId + ".pdf");
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
    void regle_metier_violee_renvoie_un_problem_detail_400() {
        ResponseEntity<JsonNode> reponse = post("/previsions", Map.of("projetId", projetId, "periode", "2026",
                "chiffreAffaires", 1000, "coutsDirects", 900, "depenses", 500));

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(reponse.getBody().get("title").asText()).isEqualTo("Données invalides");
    }

    @Test
    void openapi_swagger_et_sante_sont_exposes() {
        ResponseEntity<String> apiDocs = http.getForEntity("/v3/api-docs", String.class);
        assertThat(apiDocs.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(apiDocs.getBody()).contains("/api/finance/previsions", "/api/finance/documents/{id}/export");
        assertThat(http.getForEntity("/swagger-ui/index.html", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(http.getForEntity("/actuator/health", String.class).getBody()).contains("\"UP\"");
    }

    @Test
    void cors_autorise_l_origine_angular_configuree_seulement() {
        HttpHeaders autorise = new HttpHeaders();
        autorise.setOrigin("http://localhost:4200");
        autorise.setAccessControlRequestMethod(HttpMethod.POST);
        ResponseEntity<String> preflight = http.exchange("/api/finance/previsions", HttpMethod.OPTIONS,
                new HttpEntity<>(autorise), String.class);
        assertThat(preflight.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(preflight.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:4200");

        HttpHeaders inconnu = new HttpHeaders();
        inconnu.setOrigin("http://site-inconnu.example");
        inconnu.setAccessControlRequestMethod(HttpMethod.POST);
        assertThat(http.exchange("/api/finance/previsions", HttpMethod.OPTIONS, new HttpEntity<>(inconnu), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
