package com.launchpad.lawyer.client.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME = "lawyer.topic.exchange";
    public static final String CLIENT_QUEUE = "lawyer.client.queue";
    public static final String ROUTING_KEY_CLIENT = "lawyer.client.#";

    @Bean
    public TopicExchange lawyerTopicExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Queue clientQueue() {
        return QueueBuilder.durable(CLIENT_QUEUE).build();
    }

    @Bean
    public Binding clientBinding(Queue clientQueue, TopicExchange lawyerTopicExchange) {
        return BindingBuilder.bind(clientQueue).to(lawyerTopicExchange).with(ROUTING_KEY_CLIENT);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter);
        return template;
    }
}

