package com.launchpad.prevision;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bout en bout : serveur HTTP réel, PostgreSQL (Testcontainers) migré par Flyway.
 * Rejoue les scénarios 1 et 2 (prévisions, marges, écart, projections) et la synthèse consommée par le
 * Document-Service.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "eureka.client.enabled=false")
@Import(TestcontainersConfiguration.class)
class PrevisionServiceIntegrationTest {

    @Autowired
    private TestRestTemplate http;

    private final Long projetId = 1L;

    private ResponseEntity<JsonNode> post(String url, Object corps) {
        return http.postForEntity("/api/finance" + url, corps, JsonNode.class);
    }

    private ResponseEntity<JsonNode> get(String url) {
        return http.getForEntity("/api/finance" + url, JsonNode.class);
    }

    @Test
    void scenarios_1_et_2_de_bout_en_bout() {
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
        assertThat(get("/previsions/" + previsionId + "/ecart").getBody().get("statut").asText())
                .isEqualTo("EXCEDENT");
        assertThat(get("/projets/" + projetId + "/previsions").getBody()).hasSize(1);

        // Scénario 2 : projections, puis remplacement.
        ResponseEntity<JsonNode> projections = post("/previsions/" + previsionId + "/projections",
                Map.of("tauxCa", 10, "tauxDepenses", 5, "horizon", 3));
        assertThat(projections.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(projections.getBody().get(2).get("chiffreAffaires").decimalValue())
                .isEqualByComparingTo("133100");
        post("/previsions/" + previsionId + "/projections", Map.of("tauxCa", 20, "tauxDepenses", 0, "horizon", 2));
        JsonNode remplacees = get("/previsions/" + previsionId + "/projections").getBody();
        assertThat(remplacees).hasSize(2);
        assertThat(remplacees.get(1).get("chiffreAffaires").decimalValue()).isEqualByComparingTo("144000");

        // Synthèse consommée par le Document-Service : dernière prévision + marges + écart + projections.
        JsonNode synthese = get("/projets/" + projetId + "/synthese").getBody();
        assertThat(synthese.get("prevision").get("previsionId").asText()).isEqualTo(previsionId);
        assertThat(synthese.get("prevision").get("projections")).hasSize(2);
        assertThat(synthese.get("marges").get("margeBrute").decimalValue()).isEqualByComparingTo("60000");
        assertThat(synthese.get("ecart").get("statut").asText()).isEqualTo("EXCEDENT");
    }

    @Test
    void synthese_d_un_projet_sans_prevision_renvoie_404() {
        ResponseEntity<JsonNode> reponse = get("/projets/" + 999L + "/synthese");

        assertThat(reponse.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void ia_non_configuree_renvoie_503_sans_affecter_le_reste() {
        ResponseEntity<JsonNode> analyse = post("/ia/analyse", Map.of("titre", "Business plan", "sections", java.util.List.of()));

        assertThat(analyse.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
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
        assertThat(apiDocs.getBody()).contains("/api/finance/previsions", "/api/finance/projets/{projetId}/synthese");
        assertThat(http.getForEntity("/swagger-ui/index.html", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(http.getForEntity("/actuator/health", String.class).getBody()).contains("\"UP\"");
    }
}
