package com.launchpad.document.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
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

    /**
     * Exchange topic des événements Finance : chaque service intéressé (ce module de notification, le
     * Projet-Service IA…) y lie sa propre queue, et reçoit ainsi tous les messages de ses clés.
     */
    public static final String EXCHANGE = "finance.events";

    public static final String CLE_DOCUMENT_GENERE = "finance.document.genere";
    public static final String CLE_DOCUMENT_CERTIFIE = "finance.document.certifie";
    /** Publiées par le Prevision-Service. */
    public static final String CLE_PREVISION_A_VALIDER = "finance.prevision.a-valider";
    public static final String CLE_PREVISION_AVIS = "finance.prevision.avis";

    /** Queues des notifications de ce service (une par type d'événement, le type JSON étant déduit du listener). */
    public static final String DOCUMENT_GENERE_QUEUE = "finance.document.genere";
    public static final String PREVISION_A_VALIDER_QUEUE = "finance.notifications.prevision-a-valider";
    public static final String PREVISION_AVIS_QUEUE = "finance.notifications.prevision-avis";
    public static final String DOCUMENT_CERTIFIE_QUEUE = "finance.notifications.document-certifie";

    /** Durable, non supprimé automatiquement : mêmes paramètres que les autres services qui le déclarent. */
    @Bean
    TopicExchange financeEvents() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    /** Durable : la queue survit à un redémarrage du broker. */
    @Bean
    Queue documentGenereQueue() {
        return new Queue(DOCUMENT_GENERE_QUEUE, true);
    }

    @Bean
    Queue previsionAValiderQueue() {
        return new Queue(PREVISION_A_VALIDER_QUEUE, true);
    }

    @Bean
    Queue previsionAvisQueue() {
        return new Queue(PREVISION_AVIS_QUEUE, true);
    }

    @Bean
    Queue documentCertifieQueue() {
        return new Queue(DOCUMENT_CERTIFIE_QUEUE, true);
    }

    @Bean
    Declarables liaisons(TopicExchange financeEvents, Queue documentGenereQueue, Queue previsionAValiderQueue,
                         Queue previsionAvisQueue, Queue documentCertifieQueue) {
        return new Declarables(
                BindingBuilder.bind(documentGenereQueue).to(financeEvents).with(CLE_DOCUMENT_GENERE),
                BindingBuilder.bind(previsionAValiderQueue).to(financeEvents).with(CLE_PREVISION_A_VALIDER),
                BindingBuilder.bind(previsionAvisQueue).to(financeEvents).with(CLE_PREVISION_AVIS),
                BindingBuilder.bind(documentCertifieQueue).to(financeEvents).with(CLE_DOCUMENT_CERTIFIE));
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
