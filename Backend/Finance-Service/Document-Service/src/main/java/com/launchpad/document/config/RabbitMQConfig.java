package com.launchpad.document.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.DefaultJackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JavaTypeMapper;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ : la queue est déclarée par le consommateur (ici, le module de notification),
 * le producteur ne connaît que son nom. Spring Boot applique le MessageConverter déclaré ci-dessous
 * à RabbitTemplate (envoi) et aux @RabbitListener (réception) : objet Java ↔ JSON ↔ message AMQP.
 */
@Configuration(proxyBeanMethods = false)
public class RabbitMQConfig {

    /** Queue des événements « document généré ». */
    public static final String DOCUMENT_GENERE_QUEUE = "finance.document.genere";

    /** Durable : la queue survit à un redémarrage du broker. */
    @Bean
    Queue documentGenereQueue() {
        return new Queue(DOCUMENT_GENERE_QUEUE, true);
    }

    @Bean
    MessageConverter jsonMessageConverter() {
        return convertisseurJson();
    }

    /**
     * Seules les classes du package domain sont reconstruites à partir d'un message reçu : un message forgé ne peut
     * pas faire instancier une classe arbitraire. Le type attendu est celui du paramètre du @RabbitListener
     * (INFERRED), ce qui laisse un producteur d'un autre langage envoyer du JSON sans en-tête de type Java.
     */
    public static MessageConverter convertisseurJson() {
        DefaultJackson2JavaTypeMapper typeMapper = new DefaultJackson2JavaTypeMapper();
        typeMapper.setTrustedPackages("com.launchpad.document.domain");
        typeMapper.setTypePrecedence(Jackson2JavaTypeMapper.TypePrecedence.INFERRED);
        Jackson2JsonMessageConverter convertisseur = new Jackson2JsonMessageConverter(jsonContrat());
        convertisseur.setJavaTypeMapper(typeMapper);
        return convertisseur;
    }

    /**
     * Format du contrat d'événement (voir CONTRAT-API.md) : dates en texte ISO-8601 (« 2026-11-05T13:00:36Z »),
     * comme l'API REST, et non en nombre de secondes ; champs inconnus ignorés à la lecture, pour qu'un producteur
     * puisse ajouter un champ sans casser les consommateurs.
     */
    private static ObjectMapper jsonContrat() {
        return JsonMapper.builder()
                .findAndAddModules()
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .build();
    }
}
