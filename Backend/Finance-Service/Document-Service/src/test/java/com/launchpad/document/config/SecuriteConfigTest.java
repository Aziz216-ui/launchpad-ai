package com.launchpad.document.config;

import com.launchpad.document.controller.DocumentController;
import com.launchpad.document.service.GestionDocuments;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sécurité active (JWT_ENABLED=true) : toute route métier exige un jeton. */
@WebMvcTest(value = DocumentController.class, properties = "finance.securite.active=true")
@Import(SecuriteConfig.class)
class SecuriteConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GestionDocuments gestionDocuments;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void sans_jeton_renvoie_401() throws Exception {
        mockMvc.perform(get("/api/finance/projets/1/documents")).andExpect(status().isUnauthorized());
    }

    @Test
    void avec_jeton_la_requete_est_servie() throws Exception {
        when(gestionDocuments.listerDocuments(1L)).thenReturn(List.of());

        mockMvc.perform(get("/api/finance/projets/1/documents").with(jwt())).andExpect(status().isOk());
    }

    @Test
    void la_signature_est_l_email_du_jeton_a_defaut_le_sub() {
        Jwt avecEmail = Jwt.withTokenValue("t").header("alg", "RS256").subject("sub-1")
                .claim("email", "Conseil@LaunchPad.tn").build();
        Jwt sansEmail = Jwt.withTokenValue("t").header("alg", "RS256").subject("sub-2").build();

        assertThat(UtilisateurCourantJwt.signature(avecEmail)).isEqualTo("conseil@launchpad.tn");
        assertThat(UtilisateurCourantJwt.signature(sansEmail)).isEqualTo("sub-2");
    }
}
