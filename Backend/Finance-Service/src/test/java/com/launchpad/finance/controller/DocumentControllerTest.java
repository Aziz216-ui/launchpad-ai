package com.launchpad.finance.controller;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FichierExporte;
import com.launchpad.finance.domain.FormatExport;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.SectionDocument;
import com.launchpad.finance.domain.TypeDocument;
import com.launchpad.finance.exception.DocumentIntrouvable;
import com.launchpad.finance.exception.PrevisionIntrouvable;
import com.launchpad.finance.service.GestionDocuments;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DocumentController.class)
class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private GestionDocuments gestionDocuments;

    private static DocumentFinancier document() {
        return DocumentFinancier.creer(PROJET_ID, TypeDocument.BUSINESS_PLAN, new ContenuDocument(
                "Business plan - période 2026", List.of(new SectionDocument("Marges", List.of("Montant", "Taux (%)"),
                List.of(LigneDocument.de("Marge brute", montant("60000.00"), montant("60.00"))), List.of()))));
    }

    @Test
    void post_documents_genere_et_renvoie_201_avec_le_contenu() throws Exception {
        DocumentFinancier document = document();
        when(gestionDocuments.genererDocument(PROJET_ID, TypeDocument.BUSINESS_PLAN, null)).thenReturn(document);

        mockMvc.perform(post("/api/finance/documents").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projetId\":\"" + PROJET_ID + "\",\"type\":\"BUSINESS_PLAN\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "http://localhost/api/finance/documents/" + document.id()))
                .andExpect(jsonPath("$.documentId").value(document.id().toString()))
                .andExpect(jsonPath("$.type").value("BUSINESS_PLAN"))
                .andExpect(jsonPath("$.contenu.sections[0].lignes[0].valeurs[1]").value(60.00));
    }

    @Test
    void type_inconnu_renvoie_400() throws Exception {
        mockMvc.perform(post("/api/finance/documents").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projetId\":\"" + PROJET_ID + "\",\"type\":\"BILAN_INCONNU\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
        verifyNoInteractions(gestionDocuments);
    }

    @Test
    void champs_manquants_ou_tresorerie_negative_renvoient_400() throws Exception {
        mockMvc.perform(post("/api/finance/documents").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"tresorerieInitiale\":-1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erreurs.projetId").exists())
                .andExpect(jsonPath("$.erreurs.type").exists())
                .andExpect(jsonPath("$.erreurs.tresorerieInitiale").exists());
    }

    @Test
    void projet_sans_prevision_renvoie_404() throws Exception {
        when(gestionDocuments.genererDocument(org.mockito.ArgumentMatchers.eq(PROJET_ID),
                org.mockito.ArgumentMatchers.eq(TypeDocument.COMPTE_RESULTAT), isNull()))
                .thenThrow(PrevisionIntrouvable.pourProjet(PROJET_ID));

        mockMvc.perform(post("/api/finance/documents").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"projetId\":\"" + PROJET_ID + "\",\"type\":\"COMPTE_RESULTAT\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Aucune prévision pour le projet : " + PROJET_ID));
    }

    @Test
    void get_documents_d_un_projet_sans_le_contenu() throws Exception {
        when(gestionDocuments.listerDocuments(PROJET_ID)).thenReturn(List.of(document()));

        mockMvc.perform(get("/api/finance/projets/{projetId}/documents", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].titre").value("Business plan - période 2026"))
                .andExpect(jsonPath("$[0].contenu").doesNotExist());
    }

    @Test
    void get_document_inconnu_renvoie_404() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionDocuments.consulterDocument(id)).thenThrow(new DocumentIntrouvable(id));

        mockMvc.perform(get("/api/finance/documents/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void erreur_inattendue_renvoie_500_sans_detail_technique() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionDocuments.consulterDocument(id)).thenThrow(new IllegalStateException("secret technique"));

        mockMvc.perform(get("/api/finance/documents/{id}", id))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.title").value("Erreur interne"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("secret"))));
    }

    @Test
    void export_pdf_renvoie_le_fichier_en_telechargement() throws Exception {
        UUID id = UUID.randomUUID();
        byte[] octets = {37, 80, 68, 70};
        when(gestionDocuments.exporterDocument(id, FormatExport.PDF))
                .thenReturn(new FichierExporte("business-plan-" + id + ".pdf", "application/pdf", octets));

        mockMvc.perform(get("/api/finance/documents/{id}/export", id).param("format", "pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"business-plan-" + id + ".pdf\""))
                .andExpect(content().bytes(octets));
    }

    @Test
    void export_xlsx_utilise_le_format_excel() throws Exception {
        UUID id = UUID.randomUUID();
        when(gestionDocuments.exporterDocument(id, FormatExport.EXCEL))
                .thenReturn(new FichierExporte("doc.xlsx", FormatExport.EXCEL.typeContenu(), new byte[]{80, 75}));

        mockMvc.perform(get("/api/finance/documents/{id}/export", id).param("format", "XLSX"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(FormatExport.EXCEL.typeContenu()));
    }

    @Test
    void export_format_inconnu_ou_absent_renvoie_400() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(get("/api/finance/documents/{id}/export", id).param("format", "docx"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Format d'export inconnu : docx (pdf ou xlsx)"));
        mockMvc.perform(get("/api/finance/documents/{id}/export", id))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
        verifyNoInteractions(gestionDocuments);
    }

    @Test
    void delete_supprime_et_renvoie_204() throws Exception {
        UUID id = UUID.randomUUID();

        mockMvc.perform(delete("/api/finance/documents/{id}", id))
                .andExpect(status().isNoContent());
        verify(gestionDocuments).supprimerDocument(id);
    }

    @Test
    void delete_document_inconnu_renvoie_404() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new DocumentIntrouvable(id)).when(gestionDocuments).supprimerDocument(id);

        mockMvc.perform(delete("/api/finance/documents/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
    }
}
