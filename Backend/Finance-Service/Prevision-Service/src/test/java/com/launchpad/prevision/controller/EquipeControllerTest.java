package com.launchpad.prevision.controller;

import com.launchpad.prevision.config.SecuriteConfig;
import com.launchpad.prevision.domain.DroitsProjet;
import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.ProjetAccessible;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.exception.MembreIntrouvable;
import com.launchpad.prevision.service.acces.ControleAcces;
import com.launchpad.prevision.service.acces.GestionEquipe;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EquipeController.class)
@Import(SecuriteConfig.class)
class EquipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GestionEquipe gestionEquipe;

    @MockitoBean
    private ControleAcces controleAcces;

    @Test
    void get_acces_renvoie_les_droits_de_l_utilisateur() throws Exception {
        when(controleAcces.droits(7L)).thenReturn(DroitsProjet.de(7L, RoleProjet.FINANCIER));

        mockMvc.perform(get("/api/finance/projets/7/acces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("FINANCIER"))
                .andExpect(jsonPath("$.lecture").value(true))
                .andExpect(jsonPath("$.ecriture").value(false))
                .andExpect(jsonPath("$.validation").value(true));
    }

    @Test
    void get_mes_projets() throws Exception {
        when(gestionEquipe.mesProjets()).thenReturn(List.of(
                new ProjetAccessible(7L, RoleProjet.FINANCIER, Instant.parse("2026-11-10T10:00:00Z"), 2)));

        mockMvc.perform(get("/api/finance/mes-projets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].projetId").value(7))
                .andExpect(jsonPath("$[0].previsionsEnAttente").value(2));
    }

    @Test
    void post_financiers_invite_et_renvoie_201() throws Exception {
        when(gestionEquipe.inviterFinancier(7L, "conseil@launchpad.tn"))
                .thenReturn(MembreProjet.financier(7L, "conseil@launchpad.tn"));

        mockMvc.perform(post("/api/finance/projets/7/financiers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"conseil@launchpad.tn\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("conseil@launchpad.tn"))
                .andExpect(jsonPath("$.role").value("FINANCIER"));
    }

    @Test
    void post_financiers_email_invalide_renvoie_400() throws Exception {
        mockMvc.perform(post("/api/finance/projets/7/financiers").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"pas-un-email\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erreurs.email").exists());
        verifyNoInteractions(gestionEquipe);
    }

    @Test
    void delete_financier_renvoie_204_et_404_si_inconnu() throws Exception {
        mockMvc.perform(delete("/api/finance/projets/7/financiers/conseil@launchpad.tn"))
                .andExpect(status().isNoContent());
        verify(gestionEquipe).retirerFinancier(7L, "conseil@launchpad.tn");

        doThrow(new MembreIntrouvable(7L, "x@y.tn")).when(gestionEquipe).retirerFinancier(7L, "x@y.tn");
        mockMvc.perform(delete("/api/finance/projets/7/financiers/x@y.tn"))
                .andExpect(status().isNotFound());
    }
}
