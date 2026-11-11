package com.launchpad.prevision.config;

import com.launchpad.prevision.controller.EquipeController;
import com.launchpad.prevision.controller.PrevisionController;
import com.launchpad.prevision.domain.Fixtures;
import com.launchpad.prevision.domain.SyntheseFinanciere;
import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.ComparateurRevenusDepenses;
import com.launchpad.prevision.service.GestionPrevisions;
import com.launchpad.prevision.service.acces.ControleAcces;
import com.launchpad.prevision.service.acces.GestionEquipe;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sécurité active (JWT_ENABLED=true) : jeton exigé, sauf sur les routes ouvertes aux appels internes. */
@WebMvcTest(value = {PrevisionController.class, EquipeController.class},
        properties = "finance.securite.active=true")
@Import(SecuriteConfig.class)
class SecuriteConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GestionPrevisions gestionPrevisions;

    @MockitoBean
    private GestionEquipe gestionEquipe;

    @MockitoBean
    private ControleAcces controleAcces;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void sans_jeton_une_route_metier_renvoie_401() throws Exception {
        mockMvc.perform(get("/api/finance/projets/1/previsions")).andExpect(status().isUnauthorized());
    }

    @Test
    void avec_jeton_la_route_metier_est_servie() throws Exception {
        when(gestionPrevisions.listerPrevisions(1L)).thenReturn(List.of());

        mockMvc.perform(get("/api/finance/projets/1/previsions").with(jwt()))
                .andExpect(status().isOk());
    }

    @Test
    void la_synthese_reste_ouverte_aux_appels_internes_sans_jeton() throws Exception {
        var p = Fixtures.prevision();
        when(gestionPrevisions.consulterSynthese(1L)).thenReturn(new SyntheseFinanciere(p,
                new CalculateurMarge().calculerMarges(p), new ComparateurRevenusDepenses().comparer(p)));

        mockMvc.perform(get("/api/finance/projets/1/synthese")).andExpect(status().isOk());
    }

    @Test
    void l_utilisateur_est_lu_dans_le_jeton_keycloak() {
        Jwt jeton = Jwt.withTokenValue("t").header("alg", "RS256").subject("sub-1")
                .claim("email", "Conseil@LaunchPad.tn")
                .claim("realm_access", Map.of("roles", List.of("financier", "offline_access")))
                .build();

        Utilisateur u = UtilisateurCourantJwt.depuis(jeton);

        assertThat(u.id()).isEqualTo("sub-1");
        assertThat(u.email()).isEqualTo("conseil@launchpad.tn");
        assertThat(u.estFinancier()).isTrue();
        assertThat(u.estEntrepreneur()).isFalse();
    }
}
