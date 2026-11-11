package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.DocumentCertifie;
import com.launchpad.document.domain.DocumentGenere;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/**
 * Consommateur RabbitMQ : abonné à la queue, il reçoit le message déjà converti en DocumentGenere
 * (le MessageConverter désérialise le JSON) puis délègue au traitement métier.
 */
@Service
public class DocumentGenereConsumer {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentGenereConsumer.class);

    private final JournalNotifications notifications;

    public DocumentGenereConsumer(JournalNotifications notifications) {
        this.notifications = notifications;
    }

    @RabbitListener(queues = RabbitMQConfig.DOCUMENT_GENERE_QUEUE)
    public void recevoir(DocumentGenere evenement) {
        LOG.info("DocumentGenere reçu depuis RabbitMQ : {}", evenement);
        notifications.enregistrer(evenement);
    }

    @RabbitListener(queues = RabbitMQConfig.DOCUMENT_CERTIFIE_QUEUE)
    public void recevoir(DocumentCertifie evenement) {
        LOG.info("DocumentCertifie reçu depuis RabbitMQ : {}", evenement);
        notifications.enregistrer(evenement);
    }
}
