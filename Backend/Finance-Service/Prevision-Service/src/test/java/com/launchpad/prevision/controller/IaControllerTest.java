package com.launchpad.prevision.controller;

import com.launchpad.prevision.exception.IaIndisponible;
import com.launchpad.prevision.exception.PrevisionIntrouvable;
import com.launchpad.prevision.service.ia.AssistantFinancier;
import com.launchpad.prevision.service.ia.CommentateurEcart;
import com.launchpad.prevision.service.ia.RedacteurIA;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static com.launchpad.prevision.domain.Fixtures.PROJET_ID;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IaController.class)
@org.springframework.context.annotation.Import(com.launchpad.prevision.config.SecuriteConfig.class)
class IaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CommentateurEcart commentateurEcart;

    @MockitoBean
    private AssistantFinancier assistantFinancier;

    @MockitoBean
    private RedacteurIA redacteurIA;

    @Test
    void commentaire_renvoie_200_avec_le_texte() throws Exception {
        UUID id = UUID.randomUUID();
        when(commentateurEcart.commenter(id)).thenReturn("Situation saine.");

        mockMvc.perform(post("/api/finance/previsions/{id}/commentaire", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previsionId").value(id.toString()))
                .andExpect(jsonPath("$.commentaire").value("Situation saine."));
    }

    @Test
    void commentaire_prevision_inconnue_renvoie_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(commentateurEcart.commenter(id)).thenThrow(new PrevisionIntrouvable(id));

        mockMvc.perform(post("/api/finance/previsions/{id}/commentaire", id)).andExpect(status().isNotFound());
    }

    @Test
    void ia_indisponible_renvoie_503() throws Exception {
        UUID id = UUID.randomUUID();
        when(commentateurEcart.commenter(id)).thenThrow(new IaIndisponible("Le service d'IA n'est pas configuré"));

        mockMvc.perform(post("/api/finance/previsions/{id}/commentaire", id))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.detail").value("Le service d'IA n'est pas configuré"));
    }

    @Test
    void assistant_renvoie_la_reponse() throws Exception {
        when(assistantFinancier.repondre(PROJET_ID, "Quelle est ma marge ?")).thenReturn("60 %");

        mockMvc.perform(post("/api/finance/projets/{projetId}/assistant", PROJET_ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Quelle est ma marge ?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reponse").value("60 %"));
    }

    @Test
    void assistant_message_vide_renvoie_400() throws Exception {
        mockMvc.perform(post("/api/finance/projets/{projetId}/assistant", PROJET_ID)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erreurs.message").exists());
        verifyNoInteractions(assistantFinancier);
    }

    @Test
    void analyse_renvoie_les_paragraphes_rediges() throws Exception {
        when(redacteurIA.analyser(any())).thenReturn(List.of("Premier.", "Second."));

        mockMvc.perform(post("/api/finance/ia/analyse").contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"titre":"Business plan","sections":[{"titre":"Marges","colonnes":["Montant"],
                                 "lignes":[{"libelle":"Marge brute","valeurs":[60000.00]}],"notes":[]}]}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paragraphes[0]").value("Premier."))
                .andExpect(jsonPath("$.paragraphes[1]").value("Second."));
    }

    @Test
    void analyse_sans_titre_renvoie_400() throws Exception {
        mockMvc.perform(post("/api/finance/ia/analyse").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"titre\":\"\",\"sections\":[]}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(redacteurIA);
    }

    @Test
    void analyse_ia_indisponible_renvoie_503() throws Exception {
        when(redacteurIA.analyser(any())).thenThrow(new IaIndisponible("Le service d'IA n'est pas configuré"));

        mockMvc.perform(post("/api/finance/ia/analyse").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"titre\":\"Business plan\",\"sections\":[]}"))
                .andExpect(status().isServiceUnavailable());
    }
}
