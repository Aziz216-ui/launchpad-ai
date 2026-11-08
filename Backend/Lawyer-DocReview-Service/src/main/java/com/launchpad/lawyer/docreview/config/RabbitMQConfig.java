package com.launchpad.lawyer.docreview.config;

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
    public static final String DOCREVIEW_QUEUE = "lawyer.docreview.queue";
    public static final String DOCREVIEW_ROUTING_KEY = "lawyer.docreview.#";

    @Bean
    public DirectExchange lawyerExchange() {
        return new DirectExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue docReviewQueue() {
        return QueueBuilder.durable(DOCREVIEW_QUEUE).build();
    }

    @Bean
    public Binding docReviewBinding(Queue docReviewQueue, DirectExchange lawyerExchange) {
        return BindingBuilder.bind(docReviewQueue).to(lawyerExchange).with(DOCREVIEW_ROUTING_KEY);
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

