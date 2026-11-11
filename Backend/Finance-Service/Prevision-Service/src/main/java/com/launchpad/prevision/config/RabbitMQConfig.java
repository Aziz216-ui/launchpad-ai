package com.launchpad.prevision.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ : les événements Finance sont publiés sur l'exchange topic « finance.events ». Chaque consommateur
 * (Document-Service pour les notifications, Projet-Service IA…) déclare sa propre queue et choisit ses clés.
 */
@Configuration(proxyBeanMethods = false)
public class RabbitMQConfig {

    public static final String EXCHANGE = "finance.events";
    /** Une prévision attend l'avis d'un financier. */
    public static final String CLE_PREVISION_A_VALIDER = "finance.prevision.a-valider";
    /** Un financier a validé ou rejeté une prévision. */
    public static final String CLE_PREVISION_AVIS = "finance.prevision.avis";

    /** Durable, non supprimé automatiquement : mêmes paramètres que les autres services qui le déclarent. */
    @Bean
    TopicExchange financeEvents() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    /** JSON simple, dates en texte ISO-8601 (comme l'API REST), lisible par un service écrit dans un autre langage. */
    @Bean
    public MessageConverter jsonMessageConverter() {
        ObjectMapper json = JsonMapper.builder()
                .findAndAddModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .build();
        return new Jackson2JsonMessageConverter(json);
    }
}
