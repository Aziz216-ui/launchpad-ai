package com.launchpad.document.config;

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
        Jackson2JsonMessageConverter convertisseur = new Jackson2JsonMessageConverter();
        convertisseur.setJavaTypeMapper(typeMapper);
        return convertisseur;
    }
}
