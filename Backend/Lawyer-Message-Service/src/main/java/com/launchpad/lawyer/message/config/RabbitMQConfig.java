package com.launchpad.lawyer.message.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "lawyer.direct.exchange";
    public static final String MESSAGE_QUEUE = "lawyer.message.queue";
    public static final String MESSAGE_ROUTING_KEY = "lawyer.message.#";

    @Bean
    public DirectExchange lawyerExchange() {
        return new DirectExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue messageQueue() {
        return QueueBuilder.durable(MESSAGE_QUEUE).build();
    }

    @Bean
    public Binding messageBinding(Queue messageQueue, DirectExchange lawyerExchange) {
        return BindingBuilder.bind(messageQueue).to(lawyerExchange).with(MESSAGE_ROUTING_KEY);
    }

    // --- Écoute des événements de Lawyer-Client-Service (exchange topic déclaré par ce service) ---
    public static final String CLIENT_EVENTS_EXCHANGE = "lawyer.topic.exchange";
    public static final String CLIENT_EVENTS_QUEUE = "lawyer.message.client-events.queue";

    @Bean
    public TopicExchange clientEventsExchange() {
        return new TopicExchange(CLIENT_EVENTS_EXCHANGE, true, false); // mêmes options que l'émetteur
    }

    @Bean
    public Queue clientEventsQueue() {
        return QueueBuilder.durable(CLIENT_EVENTS_QUEUE).build();
    }

    @Bean
    public Binding clientEventsBinding(Queue clientEventsQueue, TopicExchange clientEventsExchange) {
        return BindingBuilder.bind(clientEventsQueue).to(clientEventsExchange).with("lawyer.client.#");
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}

