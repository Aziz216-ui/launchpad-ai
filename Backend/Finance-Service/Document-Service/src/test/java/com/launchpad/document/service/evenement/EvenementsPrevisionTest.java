package com.launchpad.document.service.evenement;

import com.launchpad.document.config.RabbitMQConfig;
import com.launchpad.document.domain.AvisPrevision;
import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.domain.Notification;
import com.launchpad.document.domain.Notification.Destinataire;
import com.launchpad.document.domain.Notification.TypeNotification;
import com.launchpad.document.domain.PrevisionAValider;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.MessageConverter;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;

import static com.launchpad.document.domain.Fixtures.PROJET_ID;
import static org.assertj.core.api.Assertions.assertThat;

class EvenementsPrevisionTest {

    private final JournalNotifications journal = new JournalNotifications();
    private final EvenementsPrevisionConsumer consommateur = new EvenementsPrevisionConsumer(journal);

    private static AvisPrevision avis(String statut, String commentaire) {
        return new AvisPrevision(UUID.randomUUID(), UUID.randomUUID(), PROJET_ID, "2026", statut, commentaire,
                "conseil@launchpad.tn", Instant.now());
    }

    @Test
    void une_prevision_a_valider_notifie_le_financier() {
        PrevisionAValider evenement = new PrevisionAValider(UUID.randomUUID(), UUID.randomUUID(), PROJET_ID, "2026",
                Instant.now(), "CREATION");

        consommateur.recevoir(evenement);

        Notification n = journal.notificationsDuProjet(PROJET_ID).get(0);
        assertThat(n.type()).isEqualTo(TypeNotification.PREVISION_A_VALIDER);
        assertThat(n.pour()).isEqualTo(Destinataire.FINANCIER);
        assertThat(n.previsionId()).isEqualTo(evenement.previsionId());
        assertThat(n.message()).contains("2026").contains("attend votre avis");
    }

    @Test
    void des_chiffres_modifies_apres_un_avis_notifient_tout_le_projet() {
        consommateur.recevoir(new PrevisionAValider(UUID.randomUUID(), UUID.randomUUID(), PROJET_ID, "2026",
                Instant.now(), PrevisionAValider.CHIFFRES_MODIFIES));

        Notification n = journal.notificationsDuProjet(PROJET_ID).get(0);
        assertThat(n.pour()).isEqualTo(Destinataire.TOUS);
        assertThat(n.message()).contains("a changé").contains("nouvel avis");
        assertThat(n.visiblePar(new DroitsProjet(PROJET_ID, true, true, false))).isTrue();
    }

    @Test
    void un_ancien_message_sans_motif_est_traite_comme_une_creation() {
        consommateur.recevoir(new PrevisionAValider(UUID.randomUUID(), UUID.randomUUID(), PROJET_ID, "2026",
                Instant.now(), null));

        assertThat(journal.notificationsDuProjet(PROJET_ID).get(0).pour()).isEqualTo(Destinataire.FINANCIER);
    }

    @Test
    void un_rejet_notifie_le_proprietaire_avec_le_commentaire() {
        consommateur.recevoir(avis("REJETEE", "Croissance de 40 % irréaliste"));

        Notification n = journal.notificationsDuProjet(PROJET_ID).get(0);
        assertThat(n.type()).isEqualTo(TypeNotification.PREVISION_REJETEE);
        assertThat(n.pour()).isEqualTo(Destinataire.PROPRIETAIRE);
        assertThat(n.message()).contains("rejetée").contains("conseil@launchpad.tn")
                .contains("Croissance de 40 % irréaliste");
    }

    @Test
    void une_validation_notifie_le_proprietaire() {
        consommateur.recevoir(avis("VALIDEE", null));

        assertThat(journal.notificationsDuProjet(PROJET_ID).get(0).type()).isEqualTo(TypeNotification.PREVISION_VALIDEE);
    }

    @Test
    void un_meme_avis_livre_deux_fois_n_est_notifie_qu_une_fois() {
        AvisPrevision evenement = avis("VALIDEE", null);

        consommateur.recevoir(evenement);
        consommateur.recevoir(evenement);

        assertThat(journal.notificationsDuProjet(PROJET_ID)).hasSize(1);
    }

    @Test
    void la_visibilite_suit_le_role_sur_le_projet() {
        Notification pourFinancier = new Notification(UUID.randomUUID(), PROJET_ID,
                TypeNotification.PREVISION_A_VALIDER, Destinataire.FINANCIER, "m", Instant.now(), null, null);
        DroitsProjet proprietaire = new DroitsProjet(PROJET_ID, true, true, false);
        DroitsProjet financier = new DroitsProjet(PROJET_ID, true, false, true);

        assertThat(pourFinancier.visiblePar(financier)).isTrue();
        assertThat(pourFinancier.visiblePar(proprietaire)).isFalse();
    }

    @Test
    void le_json_publie_par_le_prevision_service_est_lu() {
        MessageConverter convertisseur = RabbitMQConfig.convertisseurJson();
        MessageProperties proprietes = new MessageProperties();
        proprietes.setContentType("application/json");
        // En-tête de type Java d'un autre service : ignoré, le type du paramètre du @RabbitListener prime.
        proprietes.setHeader("__TypeId__", "com.launchpad.prevision.domain.AvisPrevision");
        proprietes.setInferredArgumentType(AvisPrevision.class);
        String json = """
                {"evenementId":"3b262c72-2222-4f01-9de3-6fb7669e7ce6","previsionId":"0d1b4c32-b9e5-4223-9ad5-efc92ef32af7",
                 "projetId":%s,"periode":"2026","statut":"REJETEE","commentaire":"Trop optimiste",
                 "auteur":"conseil@launchpad.tn","le":"2026-11-10T10:00:00Z"}
                """.formatted(PROJET_ID);

        Object lu = convertisseur.fromMessage(new Message(json.getBytes(StandardCharsets.UTF_8), proprietes));

        assertThat(lu).isInstanceOf(AvisPrevision.class);
        assertThat(((AvisPrevision) lu).commentaire()).isEqualTo("Trop optimiste");
        assertThat(((AvisPrevision) lu).le()).isEqualTo(Instant.parse("2026-11-10T10:00:00Z"));
    }
}
