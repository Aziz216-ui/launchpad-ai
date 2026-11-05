package com.launchpad.lawyer.inforequest.messaging;

import com.launchpad.lawyer.inforequest.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.time.LocalDate;

@Component
public class InfoRequestEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(InfoRequestEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public record InfoRequestNotificationEvent(
            Long requestId,
            String eventType, // CREATED, STATUS_UPDATED, UPDATED, DELETED
            String lawyerId,
            Long clientId,
            String clientName,
            String title,
            String status,
            LocalDate dueDate
    ) implements Serializable {}

    public InfoRequestEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishEvent(String eventType, Long requestId, String lawyerId, Long clientId,
                             String clientName, String title, String status, LocalDate dueDate) {
        InfoRequestNotificationEvent event = new InfoRequestNotificationEvent(
                requestId, eventType, lawyerId, clientId, clientName, title, status, dueDate
        );
        String routingKey = "lawyer.inforequest." + eventType.toLowerCase();
        try {
            log.info("Publishing async info request event [{}]: requestId={}", routingKey, requestId);
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, event);
        } catch (Exception e) {
            log.warn("Could not publish info request event to RabbitMQ (broker offline): {}", e.getMessage());
        }
    }
}

