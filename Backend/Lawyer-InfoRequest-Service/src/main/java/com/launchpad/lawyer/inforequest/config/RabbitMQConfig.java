package com.launchpad.lawyer.inforequest.config;

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
    public static final String INFOREQUEST_QUEUE = "lawyer.inforequest.queue";
    public static final String INFOREQUEST_ROUTING_KEY = "lawyer.inforequest.#";

    @Bean
    public DirectExchange lawyerExchange() {
        return new DirectExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue infoRequestQueue() {
        return QueueBuilder.durable(INFOREQUEST_QUEUE).build();
    }

    @Bean
    public Binding infoRequestBinding(Queue infoRequestQueue, DirectExchange lawyerExchange) {
        return BindingBuilder.bind(infoRequestQueue).to(lawyerExchange).with(INFOREQUEST_ROUTING_KEY);
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

