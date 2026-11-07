package com.launchpad.prevision.config;

import com.launchpad.prevision.service.ia.ClientLLM;
import com.launchpad.prevision.service.ia.ClientLLMIndisponible;
import com.launchpad.prevision.service.ia.ClientLLMSpringAi;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.model.chat.client.autoconfigure.ChatClientAutoConfiguration;
import org.springframework.ai.model.tool.autoconfigure.ToolCallingAutoConfiguration;
import org.springframework.ai.retry.autoconfigure.SpringAiRetryAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiAudioSpeechAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiAudioTranscriptionAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiChatAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiEmbeddingAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiImageAutoConfiguration;
import org.springframework.ai.model.openai.autoconfigure.OpenAiModerationAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.http.client.HttpClientAutoConfiguration;
import org.springframework.boot.autoconfigure.web.client.RestClientAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie, avec le vrai application.yml, que l'IA est désactivée par défaut sans empêcher le démarrage,
 * et qu'elle s'active par configuration (SPRING_AI_MODEL_CHAT=openai + XAI_API_KEY).
 */
class IaConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withConfiguration(AutoConfigurations.of(
                    HttpClientAutoConfiguration.class, RestClientAutoConfiguration.class,
                    SpringAiRetryAutoConfiguration.class, ToolCallingAutoConfiguration.class,
                    OpenAiChatAutoConfiguration.class, OpenAiEmbeddingAutoConfiguration.class,
                    OpenAiImageAutoConfiguration.class, OpenAiAudioSpeechAutoConfiguration.class,
                    OpenAiAudioTranscriptionAutoConfiguration.class, OpenAiModerationAutoConfiguration.class,
                    ChatClientAutoConfiguration.class))
            .withUserConfiguration(IaConfig.class);

    @Test
    void par_defaut_sans_cle_le_contexte_demarre_et_l_ia_est_indisponible() {
        runner.run(contexte -> {
            assertThat(contexte).hasNotFailed();
            assertThat(contexte).doesNotHaveBean(ChatModel.class);
            assertThat(contexte.getBean(ClientLLM.class)).isInstanceOf(ClientLLMIndisponible.class);
        });
    }

    @Test
    void active_par_configuration_l_ia_passe_par_spring_ai_vers_xai() {
        runner.withPropertyValues("spring.ai.model.chat=openai", "spring.ai.openai.api-key=cle-de-test")
                .run(contexte -> {
                    assertThat(contexte).hasNotFailed();
                    assertThat(contexte).hasSingleBean(ChatModel.class);
                    assertThat(contexte.getBean(ClientLLM.class)).isInstanceOf(ClientLLMSpringAi.class);
                    assertThat(contexte.getEnvironment().getProperty("spring.ai.openai.base-url"))
                            .isEqualTo("https://api.x.ai");
                });
    }
}
