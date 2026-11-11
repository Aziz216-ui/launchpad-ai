package com.launchpad.prevision.service.evenement;

import com.launchpad.prevision.config.RabbitMQConfig;
import com.launchpad.prevision.domain.AvisPrevision;
import com.launchpad.prevision.domain.PrevisionAValider;
import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.ValidationPrevision;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.MessageConverter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static com.launchpad.prevision.domain.Fixtures.prevision;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class PublicateurEvenementsPrevisionTest {

    private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
    private final PublicateurEvenementsPrevision publicateur = new PublicateurEvenementsPrevision(rabbit);

    @Test
    void une_prevision_a_valider_est_publiee_sur_finance_events() {
        PrevisionAValider evenement = PrevisionAValider.de(prevision());

        publicateur.publier(evenement);

        verify(rabbit).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.CLE_PREVISION_A_VALIDER),
                eq((Object) evenement));
    }

    @Test
    void un_avis_est_publie_sur_finance_events() {
        AvisPrevision evenement = AvisPrevision.de(prevision(), ValidationPrevision.avis(StatutValidation.VALIDEE,
                null, "conseil@x.tn", Instant.now()));

        publicateur.publier(evenement);

        verify(rabbit).convertAndSend(eq(RabbitMQConfig.EXCHANGE), eq(RabbitMQConfig.CLE_PREVISION_AVIS),
                eq((Object) evenement));
    }

    @Test
    void broker_indisponible_n_interrompt_pas_l_appelant() {
        doThrow(new AmqpConnectException(new IOException("refusé"))).when(rabbit)
                .convertAndSend(any(String.class), any(String.class), any(Object.class));

        assertThatCode(() -> publicateur.publier(PrevisionAValider.de(prevision()))).doesNotThrowAnyException();
    }

    @Test
    void le_message_est_du_json_simple_avec_dates_iso() {
        MessageConverter convertisseur = new RabbitMQConfig().jsonMessageConverter();
        AvisPrevision evenement = AvisPrevision.de(prevision(), ValidationPrevision.avis(StatutValidation.REJETEE,
                "Croissance irréaliste", "conseil@x.tn", Instant.parse("2026-11-10T10:00:00Z")));

        Message message = convertisseur.toMessage(evenement, new MessageProperties());
        String json = new String(message.getBody(), StandardCharsets.UTF_8);

        assertThat(json).contains("\"statut\":\"REJETEE\"")
                .contains("\"commentaire\":\"Croissance irréaliste\"")
                .contains("\"le\":\"2026-11-10T10:00:00Z\"")
                .contains("\"projetId\":1");
    }
}
