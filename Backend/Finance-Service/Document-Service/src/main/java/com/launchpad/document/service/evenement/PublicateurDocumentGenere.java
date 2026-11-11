package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.DocumentCertifie;
import com.launchpad.document.domain.DocumentGenere;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Producteur RabbitMQ : publie sur l'exchange topic finance.events avec la clé finance.document.genere.
 * <p>
 * La publication a lieu APRÈS le commit de la transaction qui a enregistré le document : aucun événement n'est
 * émis pour un document finalement annulé. Si le broker est indisponible, l'erreur est journalisée mais ne remet
 * pas en cause le document, déjà enregistré (limite connue : l'événement est alors perdu ; le patron Outbox
 * lèverait cette limite).
 */
@Component
public class PublicateurDocumentGenere {

    private static final Logger LOG = LoggerFactory.getLogger(PublicateurDocumentGenere.class);

    private final RabbitTemplate rabbitTemplate;

    public PublicateurDocumentGenere(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    /** fallbackExecution : publie aussi lorsqu'aucune transaction n'est active. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void publier(DocumentGenere evenement) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.CLE_DOCUMENT_GENERE, evenement);
            LOG.info("Événement DocumentGenere publié sur {} : document {}", RabbitMQConfig.DOCUMENT_GENERE_QUEUE,
                    evenement.documentId());
        } catch (AmqpException e) {
            LOG.error("Publication de DocumentGenere impossible (document {} enregistré, événement perdu)",
                    evenement.documentId(), e);
        }
    }

    /** Même principe : publié après le commit de la certification, sans remettre en cause celle-ci si le broker est éteint. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void publier(DocumentCertifie evenement) {
        try {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.CLE_DOCUMENT_CERTIFIE, evenement);
            LOG.info("Événement DocumentCertifie publié : document {}", evenement.documentId());
        } catch (AmqpException e) {
            LOG.error("Publication de DocumentCertifie impossible (document {} certifié, événement perdu)",
                    evenement.documentId(), e);
        }
    }
}
