package com.launchpad.lawyer.docreview.messaging;

import com.launchpad.lawyer.docreview.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.time.LocalDateTime;

@Component
public class DocReviewEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(DocReviewEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public record DocumentReviewNotificationEvent(
            Long reviewId,
            String eventType, // CREATED, COMMENT_ADDED, DECISION_TAKEN, DELETED
            String lawyerId,
            Long clientId,
            String clientName,
            String documentTitle,
            String status,
            String summary,
            LocalDateTime timestamp
    ) implements Serializable {}

    public DocReviewEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishEvent(String eventType, Long reviewId, String lawyerId, Long clientId,
                             String clientName, String documentTitle, String status, String summary) {
        DocumentReviewNotificationEvent event = new DocumentReviewNotificationEvent(
                reviewId, eventType, lawyerId, clientId, clientName, documentTitle, status, summary, LocalDateTime.now()
        );
        String routingKey = "lawyer.docreview." + eventType.toLowerCase();
        try {
            log.info("Publishing async document review event [{}]: reviewId={}", routingKey, reviewId);
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, event);
        } catch (Exception e) {
            log.warn("Could not publish document review event to RabbitMQ (broker offline): {}", e.getMessage());
        }
    }
}

