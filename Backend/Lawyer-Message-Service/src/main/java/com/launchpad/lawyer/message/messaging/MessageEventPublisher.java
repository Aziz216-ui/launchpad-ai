package com.launchpad.lawyer.message.messaging;

import com.launchpad.lawyer.message.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.time.LocalDateTime;

@Component
public class MessageEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(MessageEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public record MessageNotificationEvent(
            Long messageId,
            String lawyerId,
            Long clientId,
            String clientName,
            String subject,
            String contentPreview,
            LocalDateTime sentAt
    ) implements Serializable {}

    public MessageEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishMessageEvent(Long messageId, String lawyerId, Long clientId,
                                    String clientName, String subject, String contentPreview,
                                    LocalDateTime sentAt) {
        MessageNotificationEvent event = new MessageNotificationEvent(
                messageId, lawyerId, clientId, clientName, subject, contentPreview, sentAt
        );
        String routingKey = "lawyer.message.sent";
        try {
            log.info("Publishing async message event [{}]: messageId={}", routingKey, messageId);
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, event);
        } catch (Exception e) {
            log.warn("Could not publish message event to RabbitMQ (broker offline): {}", e.getMessage());
        }
    }
}

