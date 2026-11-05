package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.exception.IaIndisponible;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;

/**
 * Adaptateur Spring AI (ChatClient) du port ClientLLM.
 */
public class ClientLLMSpringAi implements ClientLLM {

    private static final Logger LOG = LoggerFactory.getLogger(ClientLLMSpringAi.class);

    private final ChatClient chatClient;

    public ClientLLMSpringAi(ChatClient chatClient) {
        this.chatClient = chatClient;
    }

    @Override
    public String generer(String consignes, String donnees) {
        return appeler(chatClient.prompt().system(consignes).user(donnees));
    }

    @Override
    public String converser(String consignes, String message, Object... outils) {
        return appeler(chatClient.prompt().system(consignes).user(message).tools(outils));
    }

    private static String appeler(ChatClient.ChatClientRequestSpec requete) {
        String texte;
        try {
            texte = requete.call().content();
        } catch (RuntimeException e) {
            LOG.warn("Appel au modèle de langage en échec", e);
            throw new IaIndisponible("Le service d'IA est momentanément indisponible");
        }
        if (texte == null || texte.isBlank()) {
            throw new IaIndisponible("Le service d'IA a renvoyé une réponse vide");
        }
        return texte.strip();
    }
}
