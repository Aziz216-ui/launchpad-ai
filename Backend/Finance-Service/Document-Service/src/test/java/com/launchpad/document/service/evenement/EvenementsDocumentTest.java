package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.NotificationDocument;
import com.launchpad.document.domain.TypeDocument;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.MessageConverter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EvenementsDocumentTest {

    private static DocumentGenere evenement(UUID projetId, String titre) {
        DocumentFinancier document = DocumentFinancier.creer(projetId, TypeDocument.BUSINESS_PLAN,
                new ContenuDocument(titre, List.of()));
        return DocumentGenere.de(document);
    }

    // --- Producteur -------------------------------------------------------------------------

    @Test
    void le_producteur_publie_sur_la_queue_par_son_nom() {
        RabbitTemplate rabbit = mock(RabbitTemplate.class);
        DocumentGenere evenement = evenement(PROJET_ID, "Business plan - période 2026");

        new PublicateurDocumentGenere(rabbit).publier(evenement);

        verify(rabbit).convertAndSend(eq(RabbitMQConfig.DOCUMENT_GENERE_QUEUE), eq((Object) evenement));
    }

    @Test
    void broker_indisponible_n_interrompt_pas_l_appelant() {
        RabbitTemplate rabbit = mock(RabbitTemplate.class);
        doThrow(new AmqpConnectException(new IOException("refusé"))).when(rabbit)
                .convertAndSend(any(String.class), any(Object.class));

        assertThatCode(() -> new PublicateurDocumentGenere(rabbit).publier(evenement(PROJET_ID, "t")))
                .doesNotThrowAnyException();
    }

    // --- Consommateur et traitement ---------------------------------------------------------

    @Test
    void le_consommateur_produit_une_notification_pour_le_projet() {
        JournalNotifications journal = new JournalNotifications();
        DocumentGenere evenement = evenement(PROJET_ID, "Plan de trésorerie - période 2026");

        new DocumentGenereConsumer(journal).recevoir(evenement);

        List<NotificationDocument> notifications = journal.notificationsDuProjet(PROJET_ID);
        assertThat(notifications).hasSize(1);
        assertThat(notifications.get(0).documentId()).isEqualTo(evenement.documentId());
        assertThat(notifications.get(0).message()).contains("Plan de trésorerie - période 2026");
    }

    @Test
    void un_meme_evenement_livre_deux_fois_n_est_notifie_qu_une_fois() {
        JournalNotifications journal = new JournalNotifications();
        DocumentGenere evenement = evenement(PROJET_ID, "t");

        journal.enregistrer(evenement);
        journal.enregistrer(evenement);

        assertThat(journal.notificationsDuProjet(PROJET_ID)).hasSize(1);
    }

    @Test
    void les_notifications_sont_isolees_par_projet_et_les_plus_recentes_d_abord() {
        JournalNotifications journal = new JournalNotifications();
        UUID autreProjet = UUID.randomUUID();
        DocumentGenere premier = evenement(PROJET_ID, "premier");
        DocumentGenere second = evenement(PROJET_ID, "second");
        journal.enregistrer(premier);
        journal.enregistrer(evenement(autreProjet, "ailleurs"));
        journal.enregistrer(second);

        assertThat(journal.notificationsDuProjet(PROJET_ID)).extracting(NotificationDocument::documentId)
                .containsExactly(second.documentId(), premier.documentId());
        assertThat(journal.notificationsDuProjet(autreProjet)).hasSize(1);
    }

    @Test
    void le_journal_ne_garde_que_les_dernieres_notifications() {
        JournalNotifications journal = new JournalNotifications();
        for (int i = 0; i < JournalNotifications.CAPACITE + 5; i++) {
            journal.enregistrer(evenement(PROJET_ID, "doc " + i));
        }

        assertThat(journal.notificationsDuProjet(PROJET_ID)).hasSize(JournalNotifications.CAPACITE);
    }

    // --- Contrat JSON -----------------------------------------------------------------------

    @Test
    void le_message_est_du_json_simple_qui_se_relit_en_evenement() {
        MessageConverter convertisseur = RabbitMQConfig.convertisseurJson();
        DocumentGenere evenement = evenement(PROJET_ID, "Business plan - période 2026");

        Message message = convertisseur.toMessage(evenement, new MessageProperties());
        String json = new String(message.getBody(), java.nio.charset.StandardCharsets.UTF_8);

        assertThat(json).contains("\"documentId\":\"" + evenement.documentId() + "\"")
                .contains("\"projetId\":\"" + PROJET_ID + "\"")
                .contains("\"type\":\"BUSINESS_PLAN\"")
                .contains("\"titre\":\"Business plan - période 2026\"");
        assertThat(convertisseur.fromMessage(message)).isEqualTo(evenement);
    }

    @Test
    void un_message_designant_une_classe_non_autorisee_est_refuse() {
        MessageConverter convertisseur = RabbitMQConfig.convertisseurJson();
        MessageProperties proprietes = new MessageProperties();
        proprietes.setContentType("application/json");
        proprietes.setHeader("__TypeId__", "java.lang.ProcessBuilder");
        Message forge = new Message("{\"command\":[\"calc\"]}".getBytes(java.nio.charset.StandardCharsets.UTF_8),
                proprietes);

        assertThatThrownBy(() -> convertisseur.fromMessage(forge)).isInstanceOf(RuntimeException.class);
    }
}
