package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.AvisPrevision;
import com.launchpad.document.domain.PrevisionAValider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/**
 * Consommateur RabbitMQ des événements du suivi des prévisions (publiés par le Prevision-Service sur
 * finance.events) : une queue par type, le JSON étant converti dans le type du paramètre.
 */
@Service
public class EvenementsPrevisionConsumer {

    private static final Logger LOG = LoggerFactory.getLogger(EvenementsPrevisionConsumer.class);

    private final JournalNotifications notifications;

    public EvenementsPrevisionConsumer(JournalNotifications notifications) {
        this.notifications = notifications;
    }

    @RabbitListener(queues = RabbitMQConfig.PREVISION_A_VALIDER_QUEUE)
    public void recevoir(PrevisionAValider evenement) {
        LOG.info("PrevisionAValider reçu depuis RabbitMQ : {}", evenement);
        notifications.enregistrer(evenement);
    }

    @RabbitListener(queues = RabbitMQConfig.PREVISION_AVIS_QUEUE)
    public void recevoir(AvisPrevision evenement) {
        LOG.info("AvisPrevision reçu depuis RabbitMQ : {}", evenement);
        notifications.enregistrer(evenement);
    }
}
