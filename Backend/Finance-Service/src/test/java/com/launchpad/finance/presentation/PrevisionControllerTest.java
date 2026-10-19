package com.launchpad.finance.presentation;

import com.launchpad.finance.application.GestionPrevisions;
import com.launchpad.finance.domain.exception.DonneesInvalides;
import com.launchpad.finance.domain.exception.PrevisionIntrouvable;
import com.launchpad.finance.domain.model.EcartFinancier;
import com.launchpad.finance.domain.model.Marges;
import com.launchpad.finance.domain.model.PrevisionFinanciere;
import com.launchpad.finance.domain.model.ProjectionFinanciere;
import com.launchpad.finance.domain.model.StatutEcart;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static com.launchpad.finance.domain.Fixtures.PROJET_ID;
import static com.launchpad.finance.domain.Fixtures.montant;
import static com.launchpad.finance.domain.Fixtures.prevision;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PrevisionController.class)
class PrevisionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GestionPrevisions gestionPrevisions;

    private static final String CORPS_PREVISION = """
            {"projetId":"11111111-1111-1111-1111-111111111111","periode":"2026",
             "chiffreAffaires":100000,"coutsDirects":40000,"depenses":70000}
            """;

    @Test
    void post_previsions_cree_la_prevision_et_renvoie_201_avec_location() throws Exception {
        PrevisionFinanciere p = prevision();
        when(gestionPrevisions.creerPrevision(eq(PROJET_ID), eq("2026"), any(), any(), any())).thenReturn(p);

        mockMvc.perform(post("/api/finance/previsions").contentType(MediaType.APPLICATION_JSON).content(CORPS_PREVISION))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/finance/previsions/" + p.id()))
                .andExpect(jsonPath("$.previsionId").value(p.id().toString()))
                .andExpect(jsonPath("$.resultat").value(30000.00))
                .andExpect(jsonPath("$.projections").isEmpty());
    }

    @Test
    void post_previsions_invalide_renvoie_400_problem_detail_par_champ() throws Exception {
        mockMvc.perform(post("/api/finance/previsions").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"periode\":\"\",\"chiffreAffaires\":-5,\"coutsDirects\":0,\"depenses\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Données invalides"))
                .andExpect(jsonPath("$.erreurs.projetId").exists())
                .andExpect(jsonPath("$.erreurs.periode").exists())
                .andExpect(jsonPath("$.erreurs.chiffreAffaires").exists());
        verifyNoInteractions(gestionPrevisions);
    }

    @Test
    void regle_metier_violee_renvoie_400() throws Exception {
        when(gestionPrevisions.creerPrevision(any(), any(), any(), any(), any()))
                .thenThrow(new DonneesInvalides("coutsDirects ne peut pas dépasser depenses"));

        mockMvc.perform(post("/api/finance/previsions").contentType(MediaType.APPLICATION_JSON).content(CORPS_PREVISION))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("coutsDirects ne peut pas dépasser depenses"));
    }

    @Test
    void prevision_inconnue_renvoie_404_problem_detail() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionPrevisions.consulterPrevision(id)).thenThrow(new PrevisionIntrouvable(id));

        mockMvc.perform(get("/api/finance/previsions/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Ressource introuvable"))
                .andExpect(jsonPath("$.detail").value("Prévision introuvable : " + id));
    }

    @Test
    void identifiant_mal_forme_renvoie_400() throws Exception {
        mockMvc.perform(get("/api/finance/previsions/pas-un-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void get_previsions_d_un_projet() throws Exception {
        when(gestionPrevisions.listerPrevisions(PROJET_ID)).thenReturn(List.of(prevision(), prevision()));

        mockMvc.perform(get("/api/finance/projets/{projetId}/previsions", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].projetId").value(PROJET_ID.toString()));
    }

    @Test
    void get_marges() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionPrevisions.consulterMarges(id)).thenReturn(
                new Marges(montant("60000.00"), montant("30000.00"), montant("60.00"), montant("30.00")));

        mockMvc.perform(get("/api/finance/previsions/{id}/marges", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.margeBrute").value(60000.00))
                .andExpect(jsonPath("$.margeNette").value(30000.00))
                .andExpect(jsonPath("$.tauxMargeBrute").value(60.00))
                .andExpect(jsonPath("$.tauxMargeNette").value(30.00));
    }

    @Test
    void get_ecart() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionPrevisions.comparerRevenusDepenses(id))
                .thenReturn(new EcartFinancier(montant("-2000.00"), montant("-25.00"), StatutEcart.DEFICIT));

        mockMvc.perform(get("/api/finance/previsions/{id}/ecart", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.montant").value(-2000.00))
                .andExpect(jsonPath("$.pourcentage").value(-25.00))
                .andExpect(jsonPath("$.statut").value("DEFICIT"));
    }

    @Test
    void post_projections_renvoie_201_avec_les_projections() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionPrevisions.genererProjections(id, montant("10"), montant("5"), 2)).thenReturn(List.of(
                ProjectionFinanciere.de(1, montant("110000"), montant("73500")),
                ProjectionFinanciere.de(2, montant("121000"), montant("77175"))));

        mockMvc.perform(post("/api/finance/previsions/{id}/projections", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tauxCa\":10,\"tauxDepenses\":5,\"horizon\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].annee").value(2))
                .andExpect(jsonPath("$[1].marge").value(43825.00));
    }

    @Test
    void post_projections_horizon_hors_bornes_renvoie_400() throws Exception {
        mockMvc.perform(post("/api/finance/previsions/{id}/projections", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tauxCa\":10,\"tauxDepenses\":-100,\"horizon\":11}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erreurs.horizon").exists())
                .andExpect(jsonPath("$.erreurs.tauxDepenses").exists());
        verifyNoInteractions(gestionPrevisions);
    }

    @Test
    void get_projections() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionPrevisions.consulterProjections(id))
                .thenReturn(List.of(ProjectionFinanciere.de(1, montant("110000"), montant("73500"))));

        mockMvc.perform(get("/api/finance/previsions/{id}/projections", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].chiffreAffaires").value(110000.00));
    }
}
