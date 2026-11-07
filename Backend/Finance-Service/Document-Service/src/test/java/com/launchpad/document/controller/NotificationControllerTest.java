package com.launchpad.document.controller;

import com.launchpad.document.domain.NotificationDocument;
import com.launchpad.document.service.evenement.JournalNotifications;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JournalNotifications journal;

    @Test
    void renvoie_les_notifications_du_projet() throws Exception {
        UUID documentId = UUID.randomUUID();
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of(
                new NotificationDocument(documentId, PROJET_ID, "Votre document est disponible.", Instant.now())));

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].documentId").value(documentId.toString()))
                .andExpect(jsonPath("$[0].message").value("Votre document est disponible."));
    }

    @Test
    void projet_sans_notification_renvoie_une_liste_vide() throws Exception {
        when(journal.notificationsDuProjet(PROJET_ID)).thenReturn(List.of());

        mockMvc.perform(get("/api/finance/projets/{projetId}/notifications", PROJET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }
}
