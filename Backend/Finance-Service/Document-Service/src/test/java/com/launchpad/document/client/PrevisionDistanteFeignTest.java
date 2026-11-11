package com.launchpad.document.client;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.SectionDocument;
import com.launchpad.document.domain.SynthesePrevision;
import com.launchpad.document.exception.IaIndisponible;
import com.launchpad.document.exception.PrevisionIntrouvable;
import com.launchpad.document.exception.ServiceIndisponible;
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
import java.util.concurrent.atomic.AtomicReference;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le Prevision-Service (appelé par Feign) est simulé par un vrai serveur HTTP local : on vérifie la requête émise, la lecture de la
 * réponse et la dégradation (service éteint, en erreur, IA indisponible) sans dépendre d'un autre processus.
 */
class PrevisionDistanteFeignTest {

    private static final String SYNTHESE_JSON = """
            {"prevision":{"previsionId":"22222222-2222-2222-2222-222222222222","projetId":1,
              "periode":"2026","chiffreAffaires":100000.00,"coutsDirects":40000.00,"depenses":70000.00,"resultat":30000.00,
              "creeLe":"2026-01-01T00:00:00Z",
              "projections":[{"annee":1,"chiffreAffaires":110000.00,"depenses":73500.00,"marge":36500.00}]},
             "marges":{"previsionId":"22222222-2222-2222-2222-222222222222","margeBrute":60000.00,"margeNette":30000.00,
              "tauxMargeBrute":60.00,"tauxMargeNette":30.00},
             "ecart":{"previsionId":"22222222-2222-2222-2222-222222222222","montant":30000.00,"pourcentage":30.00,"statut":"EXCEDENT"}}
            """;

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
    private static <T> T feign(Class<T> type, String adresse) {
        ObjectFactory<HttpMessageConverters> convertisseurs =
                () -> new HttpMessageConverters(new MappingJackson2HttpMessageConverter());
        return Feign.builder()
                .contract(new SpringMvcContract())
                .encoder(new SpringEncoder(convertisseurs))
                .decoder(new ResponseEntityDecoder(new SpringDecoder(convertisseurs)))
                .options(new Request.Options(2, TimeUnit.SECONDS, 2, TimeUnit.SECONDS, true))
                .retryer(Retryer.NEVER_RETRY)
                .target(type, adresse);
    }

    private PrevisionDistanteFeign previsions(String adresse) {
        return new PrevisionDistanteFeign(feign(PrevisionFeignClient.class, adresse));
    }

    private AnalyseDistanteFeign analyse(String adresse) {
        return new AnalyseDistanteFeign(feign(AnalyseFeignClient.class, adresse));
    }

    private void repondre(String chemin, int statut, String corps) {
        serveur.createContext(chemin, echange -> {
            byte[] octets = corps.getBytes(StandardCharsets.UTF_8);
            echange.getResponseHeaders().add("Content-Type", "application/json");
            echange.sendResponseHeaders(statut, octets.length);
            echange.getResponseBody().write(octets);
            echange.close();
        });
    }

    private static int portLibre() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    @Test
    void lit_la_synthese_du_prevision_service() {
        repondre("/api/finance/projets/" + PROJET_ID + "/synthese", 200, SYNTHESE_JSON);

        SynthesePrevision synthese = previsions(adresseServeur()).derniereSynthese(PROJET_ID);

        assertThat(synthese.periode()).isEqualTo("2026");
        assertThat(synthese.chiffreAffaires()).isEqualByComparingTo("100000");
        assertThat(synthese.margeBrute()).isEqualByComparingTo("60000");
        assertThat(synthese.tauxMargeNette()).isEqualByComparingTo("30");
        assertThat(synthese.ecartStatut()).isEqualTo("EXCEDENT");
        assertThat(synthese.projections()).singleElement()
                .satisfies(p -> assertThat(p.marge()).isEqualByComparingTo("36500"));
    }

    @Test
    void projet_sans_prevision_devient_prevision_introuvable() {
        repondre("/api/finance/projets/" + PROJET_ID + "/synthese", 404, "{}");

        assertThatThrownBy(() -> previsions(adresseServeur()).derniereSynthese(PROJET_ID))
                .isInstanceOf(PrevisionIntrouvable.class);
    }

    @Test
    void erreur_serveur_devient_service_indisponible() {
        repondre("/api/finance/projets/" + PROJET_ID + "/synthese", 500, "{}");

        assertThatThrownBy(() -> previsions(adresseServeur()).derniereSynthese(PROJET_ID))
                .isInstanceOf(ServiceIndisponible.class);
    }

    @Test
    void service_eteint_ne_plante_pas_et_devient_service_indisponible() throws IOException {
        assertThatThrownBy(() -> previsions("http://localhost:" + portLibre()).derniereSynthese(PROJET_ID))
                .isInstanceOf(ServiceIndisponible.class)
                .hasMessageContaining("indisponible")
                // Le message part tel quel au client (ProblemDetail) : aucune adresse ni détail technique interne.
                .hasMessageNotContaining("localhost")
                .hasMessageNotContaining("http");
    }

    @Test
    void analyse_renvoie_les_paragraphes_et_envoie_les_tableaux() {
        AtomicReference<String> corpsRecu = new AtomicReference<>();
        serveur.createContext("/api/finance/ia/analyse", echange -> {
            corpsRecu.set(new String(echange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] octets = "{\"paragraphes\":[\"Premier.\",\"Second.\"]}".getBytes(StandardCharsets.UTF_8);
            echange.getResponseHeaders().add("Content-Type", "application/json");
            echange.sendResponseHeaders(200, octets.length);
            echange.getResponseBody().write(octets);
            echange.close();
        });
        ContenuDocument contenu = new ContenuDocument("Business plan",
                List.of(new SectionDocument("Marges", List.of("Montant"), List.of(), List.of("note"))));

        assertThat(analyse(adresseServeur()).analyser(contenu)).containsExactly("Premier.", "Second.");
        assertThat(corpsRecu.get()).contains("\"titre\":\"Business plan\"").contains("\"Marges\"");
    }

    @Test
    void analyse_ia_indisponible_cote_prevision_devient_ia_indisponible() {
        repondre("/api/finance/ia/analyse", 503, "{\"detail\":\"Le service d'IA n'est pas configuré\"}");

        assertThatThrownBy(() -> analyse(adresseServeur()).analyser(new ContenuDocument("t", List.of())))
                .isInstanceOf(IaIndisponible.class);
    }

    @Test
    void analyse_avec_prevision_service_eteint_devient_service_indisponible() throws IOException {
        assertThatThrownBy(() -> analyse("http://localhost:" + portLibre()).analyser(new ContenuDocument("t", List.of())))
                .isInstanceOf(ServiceIndisponible.class)
                .hasMessageNotContaining("localhost");
    }

    private AccesDistantFeign acces(String adresse) {
        return new AccesDistantFeign(feign(PrevisionFeignClient.class, adresse));
    }

    @Test
    void lit_les_droits_de_l_utilisateur_sur_le_projet() {
        repondre("/api/finance/projets/" + PROJET_ID + "/acces", 200,
                "{\"projetId\":1,\"role\":\"FINANCIER\",\"lecture\":true,\"ecriture\":false,\"validation\":true}");

        com.launchpad.document.domain.DroitsProjet droits = acces(adresseServeur()).droits(PROJET_ID);

        assertThat(droits.lecture()).isTrue();
        assertThat(droits.ecriture()).isFalse();
        assertThat(droits.validation()).isTrue();
    }

    @Test
    void droits_refuses_ou_service_eteint_n_accordent_jamais_l_acces() throws IOException {
        repondre("/api/finance/projets/" + PROJET_ID + "/acces", 401, "{}");

        assertThatThrownBy(() -> acces(adresseServeur()).droits(PROJET_ID))
                .isInstanceOf(com.launchpad.document.exception.AccesRefuse.class);
        assertThatThrownBy(() -> acces("http://localhost:" + portLibre()).droits(PROJET_ID))
                .isInstanceOf(ServiceIndisponible.class);
    }
}
