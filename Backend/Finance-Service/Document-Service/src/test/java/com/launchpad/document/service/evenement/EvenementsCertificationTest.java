package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.Certification;
import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentCertifie;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.EtatPrevision;
import com.launchpad.document.domain.Notification;
import com.launchpad.document.domain.Notification.Destinataire;
import com.launchpad.document.domain.Notification.TypeNotification;
import com.launchpad.document.domain.TypeDocument;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class EvenementsCertificationTest {

    private final DocumentFinancier certifie = DocumentFinancier.creer(PROJET_ID, TypeDocument.BUSINESS_PLAN,
                    new ContenuDocument("Business plan - période 2026", List.of()), UUID.randomUUID(), "e")
            .certifier(new Certification("conseil@launchpad.tn", "Conforme", Instant.now()),
                    new EtatPrevision("VALIDEE", "e"));

    @Test
    void la_certification_est_publiee_sur_finance_events() {
        RabbitTemplate rabbit = mock(RabbitTemplate.class);
        DocumentCertifie evenement = DocumentCertifie.de(certifie);

        new PublicateurDocumentGenere(rabbit).publier(evenement);

        verify(rabbit).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.CLE_DOCUMENT_CERTIFIE),
                eq((Object) evenement));
    }

    @Test
    void la_certification_notifie_le_proprietaire_sans_etre_prise_pour_la_generation() {
        JournalNotifications journal = new JournalNotifications();
        DocumentGenereConsumer consommateur = new DocumentGenereConsumer(journal);

        consommateur.recevoir(DocumentGenere.de(certifie));
        consommateur.recevoir(DocumentCertifie.de(certifie));
        consommateur.recevoir(DocumentCertifie.de(certifie)); // livrée deux fois

        List<Notification> notifications = journal.notificationsDuProjet(PROJET_ID);
        assertThat(notifications).hasSize(2);
        Notification certification = notifications.get(0);
        assertThat(certification.type()).isEqualTo(TypeNotification.DOCUMENT_CERTIFIE);
        assertThat(certification.pour()).isEqualTo(Destinataire.PROPRIETAIRE);
        assertThat(certification.message()).contains("certifié par conseil@launchpad.tn").contains("Conforme")
                .contains("investisseur");
    }
}
