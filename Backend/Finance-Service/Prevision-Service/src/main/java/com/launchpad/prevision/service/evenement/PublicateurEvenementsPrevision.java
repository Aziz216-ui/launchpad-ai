package com.launchpad.prevision.service.evenement;

import com.launchpad.prevision.config.RabbitMQConfig;
import com.launchpad.prevision.domain.AvisPrevision;
import com.launchpad.prevision.domain.PrevisionAValider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Producteur RabbitMQ des événements du suivi des prévisions, sur l'exchange topic finance.events.
 * <p>
 * La publication a lieu APRÈS le commit : aucun événement pour une opération annulée. Si le broker est
 * indisponible, l'erreur est journalisée sans remettre en cause l'opération (l'événement est alors perdu ; le patron
 * Outbox lèverait cette limite).
 */
@Component
public class PublicateurEvenementsPrevision {

    private static final Logger LOG = LoggerFactory.getLogger(PublicateurEvenementsPrevision.class);

    private final RabbitTemplate rabbitTemplate;

    public PublicateurEvenementsPrevision(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void publier(PrevisionAValider evenement) {
        envoyer(RabbitMQConfig.CLE_PREVISION_A_VALIDER, evenement, evenement.previsionId().toString());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void publier(AvisPrevision evenement) {
        envoyer(RabbitMQConfig.CLE_PREVISION_AVIS, evenement, evenement.previsionId().toString());
    }

    private void envoyer(String cle, Object evenement, String previsionId) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, cle, evenement);
            LOG.info("Événement {} publié : prévision {}", cle, previsionId);
        } catch (AmqpException e) {
            LOG.error("Publication de {} impossible (prévision {}, événement perdu)", cle, previsionId, e);
        }
    }
}
