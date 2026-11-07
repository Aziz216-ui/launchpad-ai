package com.launchpad.lawyer.client.messaging;

import com.launchpad.lawyer.client.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.time.LocalDateTime;

@Component
public class ClientEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ClientEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public record ClientNotificationEvent(
            Long clientId,
            String eventType, // CREATED, UPDATED, ARCHIVED, DELETED
            String lawyerId,
            String fullName,
            String email,
            String status,
            LocalDateTime timestamp
    ) implements Serializable {}

    public ClientEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishClientEvent(String eventType, Long clientId, String lawyerId, String fullName, String email, String status) {
        ClientNotificationEvent event = new ClientNotificationEvent(
                clientId, eventType, lawyerId, fullName, email, status, LocalDateTime.now()
        );
        String routingKey = "lawyer.client." + eventType.toLowerCase();
        try {
            log.info("Publishing async client event [{}]: clientId={}", routingKey, clientId);
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, event);
        } catch (Exception e) {
            log.warn("Could not publish client event to RabbitMQ (broker offline): {}", e.getMessage());
        }
    }
}

