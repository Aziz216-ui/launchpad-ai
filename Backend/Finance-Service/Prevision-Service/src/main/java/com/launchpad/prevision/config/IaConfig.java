package com.launchpad.prevision.config;

import com.launchpad.prevision.service.ia.ClientLLM;
import com.launchpad.prevision.service.ia.ClientLLMIndisponible;
import com.launchpad.prevision.service.ia.ClientLLMSpringAi;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Branche le port ClientLLM : sur Spring AI quand un modèle de chat est configuré
 * (spring.ai.model.chat), sinon sur une implémentation qui signale l'IA indisponible.
 */
@Configuration(proxyBeanMethods = false)
public class IaConfig {

    @Bean
    ClientLLM clientLLM(ObjectProvider<ChatModel> chatModel) {
        ChatModel modele = chatModel.getIfAvailable();
        return modele == null ? new ClientLLMIndisponible() : new ClientLLMSpringAi(ChatClient.create(modele));
    }
}
