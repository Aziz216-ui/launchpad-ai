package com.launchpad.lawyer.message.messaging;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.launchpad.lawyer.message.config.RabbitMQConfig;
import com.launchpad.lawyer.message.entity.Message;
import com.launchpad.lawyer.message.repository.MessageRepository;

/**
 * Communication ASYNCHRONE (RabbitMQ) : écoute les événements publiés par Lawyer-Client-Service
 * (exchange lawyer.topic.exchange, clé lawyer.client.#) et garde les messages cohérents.
 *   DELETED -> supprime les messages de ce client
 *   UPDATED -> rafraîchit le nom / l'email copiés dans les messages
 */
@Component
public class ClientEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ClientEventConsumer.class);

    /** Sous-ensemble des champs de ClientNotificationEvent (les champs inconnus sont ignorés). */
    public record ClientEvent(Long clientId, String eventType, String lawyerId,
                              String fullName, String email, String status) {}

    private final MessageRepository messages;

    public ClientEventConsumer(MessageRepository messages) {
        this.messages = messages;
    }

    @RabbitListener(queues = RabbitMQConfig.CLIENT_EVENTS_QUEUE)
    @Transactional
    public void onClientEvent(ClientEvent event) {
        if (event == null || event.clientId() == null || event.eventType() == null) {
            return;
        }
        log.info("Événement client reçu [{}] clientId={}", event.eventType(), event.clientId());
        List<Message> concernes = messages.findByLawyerIdAndClientIdOrderBySentAtAsc(event.lawyerId(), event.clientId());
        switch (event.eventType()) {
            case "DELETED" -> messages.deleteAll(concernes);
            case "UPDATED" -> {
                concernes.forEach(m -> {
                    m.setClientName(event.fullName());
                    m.setClientEmail(event.email());
                });
                messages.saveAll(concernes);
            }
            default -> { /* CREATED, ARCHIVED : rien à synchroniser */ }
        }
    }
}
