package com.launchpad.document.controller;

import com.launchpad.document.config.SecuriteConfig;
import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.domain.Notification;
import com.launchpad.document.domain.Notification.Destinataire;
import com.launchpad.document.domain.Notification.TypeNotification;
import com.launchpad.document.exception.AccesRefuse;
import com.launchpad.document.service.acces.ControleAcces;
import com.launchpad.document.service.evenement.JournalNotifications;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@Import(SecuriteConfig.class)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JournalNotifications journal;

    @MockitoBean
    private ControleAcces controleAcces;

    private static Notification notification(TypeNotification type, Destinataire pour, String message) {
        return new Notification(UUID.randomUUID(), PROJET_ID, type, pour, message, Instant.now(), null,
                UUID.randomUUID());
    }

    @Test
    void sans_acces_au_projet_renvoie_403() throws Exception {
        when(controleAcces.exigerLecture(PROJET_ID)).thenThrow(new AccesRefuse("Vous n'avez pas accès"));

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isForbidden());
        verifyNoInteractions(journal);
    }

    @Test
    void renvoie_les_notifications_du_projet() throws Exception {
        UUID documentId = UUID.randomUUID();
        when(controleAcces.exigerLecture(PROJET_ID)).thenReturn(DroitsProjet.tous(PROJET_ID));
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of(new Notification(documentId, PROJET_ID,
                TypeNotification.DOCUMENT_GENERE, Destinataire.TOUS, "Le document est disponible.", Instant.now(),
                documentId, null)));

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].documentId").value(documentId.toString()))
                .andExpect(jsonPath("$[0].type").value("DOCUMENT_GENERE"))
                .andExpect(jsonPath("$[0].message").value("Le document est disponible."));
    }

    @Test
    void le_financier_ne_voit_que_ce_qui_le_concerne() throws Exception {
        when(controleAcces.exigerLecture(PROJET_ID)).thenReturn(new DroitsProjet(PROJET_ID, true, false, true));
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of(
                notification(TypeNotification.PREVISION_REJETEE, Destinataire.PROPRIETAIRE, "rejetée"),
                notification(TypeNotification.PREVISION_A_VALIDER, Destinataire.FINANCIER, "à valider")));

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("PREVISION_A_VALIDER"));
    }

    @Test
    void le_proprietaire_voit_les_avis_mais_pas_les_demandes_de_validation() throws Exception {
        when(controleAcces.exigerLecture(PROJET_ID)).thenReturn(new DroitsProjet(PROJET_ID, true, true, false));
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of(
                notification(TypeNotification.PREVISION_REJETEE, Destinataire.PROPRIETAIRE, "rejetée"),
                notification(TypeNotification.PREVISION_A_VALIDER, Destinataire.FINANCIER, "à valider")));

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("PREVISION_REJETEE"));
    }

    @Test
    void projet_sans_notification_renvoie_une_liste_vide() throws Exception {
        when(controleAcces.exigerLecture(PROJET_ID)).thenReturn(DroitsProjet.tous(PROJET_ID));
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of());

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
