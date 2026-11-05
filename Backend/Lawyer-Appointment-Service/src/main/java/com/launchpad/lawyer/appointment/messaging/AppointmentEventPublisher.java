package com.launchpad.lawyer.appointment.messaging;

import com.launchpad.lawyer.appointment.config.RabbitMQConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.time.LocalDateTime;

@Component
public class AppointmentEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(AppointmentEventPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public record AppointmentNotificationEvent(
            Long appointmentId,
            String eventType, // SCHEDULED, RESCHEDULED, CANCELLED, COMPLETED, DELETED
            String lawyerId,
            Long clientId,
            String clientName,
            String title,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String location,
            String status
    ) implements Serializable {}

    public AppointmentEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publishAppointmentEvent(String eventType, Long appointmentId, String lawyerId, Long clientId,
                                        String clientName, String title, LocalDateTime startTime,
                                        LocalDateTime endTime, String location, String status) {
        AppointmentNotificationEvent event = new AppointmentNotificationEvent(
                appointmentId, eventType, lawyerId, clientId, clientName, title, startTime, endTime, location, status
        );
        String routingKey = "lawyer.appointment." + eventType.toLowerCase();
        try {
            log.info("Publishing async appointment event [{}]: appointmentId={}", routingKey, appointmentId);
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, routingKey, event);
        } catch (Exception e) {
            log.warn("Could not publish appointment event to RabbitMQ (broker offline): {}", e.getMessage());
        }
    }
}

