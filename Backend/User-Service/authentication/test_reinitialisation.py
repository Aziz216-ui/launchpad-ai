"""
Tests du « Mot de passe oublié » par code (Keycloak mocké ; e-mails dans mail.outbox,
backend de test de Django ; envoi synchrone).
"""
import re
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from keycloak.exceptions import KeycloakPutError
from rest_framework import status
from rest_framework.test import APITestCase

from authentication.models import CodeReinitialisation, DemandeReinitialisation
from authentication.reinitialisation import MESSAGE, SUJET, faiblesses_mot_de_passe, hacher

DEMANDE = "/api/auth/forgot-password/"
RESET = "/api/auth/reset-password/"
ADEM = {"id": "kc-adem", "username": "adem", "email": "adem@launchpad.local", "firstName": "Adem",
        "enabled": True}
NOUVEAU = "Nouveau@2026"


def faux_keycloak(comptes=(ADEM,)):
    kc = MagicMock()
    kc.find_user_by_email.side_effect = lambda e: next(
        (c for c in comptes if c.get("email", "").lower() == e.lower()), None)
    kc.find_user.side_effect = lambda u: next((c for c in comptes if c["username"] == u.lower()), None)
    return kc


@override_settings(PASSWORD_RESET_ASYNC=False, PASSWORD_RESET_CODE_MINUTES=10, PASSWORD_RESET_MAX_ATTEMPTS=5,
                   PASSWORD_RESET_MAX_REQUESTS=3, PASSWORD_RESET_WINDOW_MINUTES=15,
                   EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class BaseReinitialisation(APITestCase):
    def setUp(self):
        self.kc = faux_keycloak()
        patcher = patch("authentication.reinitialisation.KeycloakService", return_value=self.kc)
        patcher.start()
        self.addCleanup(patcher.stop)

    def demander(self, identifiant="adem@launchpad.local", **entetes):
        return self.client.post(DEMANDE, {"identifiant": identifiant}, format="json", **entetes)

    def code_recu(self):
        return re.search(r"voici votre code : (\d{6})", mail.outbox[-1].body).group(1)

    def reinitialiser(self, code, mot_de_passe=NOUVEAU, identifiant="adem"):
        return self.client.post(RESET, {"identifiant": identifiant, "code": code,
                                        "nouveau_mot_de_passe": mot_de_passe}, format="json")

    def assert_neutre(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"message": MESSAGE})

    def assert_erreur(self, response, code_erreur, message=None):
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.json())
        self.assertEqual(response.json()["code_erreur"], code_erreur)
        if message:
            self.assertEqual(response.json()["error"], message)


# --- Étape 1 : demande de code ------------------------------------------------------------

class DemandeCodeTests(BaseReinitialisation):
    def test_email_en_francais_avec_code_et_prenom(self):
        self.assert_neutre(self.demander())
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual((email.subject, email.to), (SUJET, ["adem@launchpad.local"]))
        code = self.code_recu()
        self.assertEqual(email.body, f"Bonjour Adem, voici votre code : {code}. Il est valable 10 minutes. "
                                     "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.")
        html, type_mime = email.alternatives[0]
        self.assertEqual(type_mime, "text/html")
        self.assertIn(code, html)

    def test_seul_le_hache_est_stocke(self):
        self.demander()
        code = self.code_recu()
        actif = CodeReinitialisation.objects.get(keycloak_id="kc-adem")
        self.assertNotIn(code, actif.code_hache)
        self.assertEqual(actif.code_hache, hacher("kc-adem", code))
        restant = actif.expire_le - timezone.now()
        self.assertTrue(timedelta(minutes=9) < restant <= timedelta(minutes=10))

    def test_par_nom_d_utilisateur(self):
        self.assert_neutre(self.demander("adem"))
        self.assertEqual(len(mail.outbox), 1)

    def test_compte_inexistant_meme_reponse_aucun_email(self):
        avec, sans = self.demander(), self.demander("personne@exemple.tn")
        self.assertEqual((avec.status_code, avec.json()), (sans.status_code, sans.json()))
        self.assertEqual(len(mail.outbox), 1)

    def test_nouvelle_demande_annule_l_ancien_code(self):
        self.demander()
        ancien = self.code_recu()
        self.demander()
        nouveau = self.code_recu()
        self.assertEqual(CodeReinitialisation.objects.count(), 1)
        if ancien != nouveau:  # (1 chance sur un million d'être égaux)
            self.assert_erreur(self.reinitialiser(ancien), "code_invalide")
        self.assertEqual(self.reinitialiser(nouveau).status_code, status.HTTP_200_OK)

    def test_prenom_du_profil_si_absent_de_keycloak(self):
        get_user_model().objects.create(keycloak_id="kc-adem", username="adem", email="adem@launchpad.local",
                                        first_name="Ademou")
        self.kc.find_user_by_email.side_effect = lambda e: {**ADEM, "firstName": ""}
        self.demander()
        self.assertTrue(mail.outbox[0].body.startswith("Bonjour Ademou,"))

    def test_limite_3_demandes_par_email(self):
        for _ in range(3):
            self.assert_neutre(self.demander())
        self.assert_neutre(self.demander("adem"))  # 4e, via le nom d'utilisateur : même e-mail
        self.assertEqual(len(mail.outbox), 3)

    def test_limite_levee_apres_15_minutes(self):
        for _ in range(3):
            self.demander()
        DemandeReinitialisation.objects.update(date=timezone.now() - timedelta(minutes=16))
        self.demander()
        self.assertEqual(len(mail.outbox), 4)

    def test_compte_sans_email_ou_desactive(self):
        self.kc.find_user.side_effect = lambda u: {**ADEM, "email": ""}
        self.assert_neutre(self.demander("adem"))
        self.kc.find_user.side_effect = lambda u: {**ADEM, "enabled": False}
        self.assert_neutre(self.demander("adem"))
        self.assertEqual(len(mail.outbox), 0)

    def test_echec_smtp_reponse_neutre(self):
        with patch("authentication.reinitialisation.send_mail", side_effect=OSError("SMTP injoignable")):
            self.assert_neutre(self.demander())

    def test_keycloak_injoignable_503(self):
        self.kc.find_user_by_email.side_effect = Exception("Connection refused")
        self.assertEqual(self.demander().status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_identifiant_obligatoire(self):
        self.assertEqual(self.client.post(DEMANDE, {}, format="json").status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_meme_avec_un_jeton_expire(self):
        self.assert_neutre(self.demander(HTTP_AUTHORIZATION="Bearer jeton-expire"))

    @override_settings(PASSWORD_RESET_ASYNC=True)
    def test_envoi_hors_de_la_requete(self):
        with patch("authentication.reinitialisation.threading.Thread") as thread:
            self.assert_neutre(self.demander())
        thread.return_value.start.assert_called_once()
        self.assertEqual(len(mail.outbox), 0)  # envoyé par le thread, pas dans la requête
        self.assertTrue(CodeReinitialisation.objects.filter(keycloak_id="kc-adem").exists())


# --- Étape 2 : code + nouveau mot de passe ------------------------------------------------------

class ReinitialisationTests(BaseReinitialisation):
    def setUp(self):
        super().setUp()
        self.demander()
        self.code = self.code_recu()

    def faux(self):
        return "000000" if self.code != "000000" else "111111"

    def test_succes(self):
        response = self.reinitialiser(self.code)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["message"], "Votre mot de passe a été modifié. Vous pouvez vous connecter.")
        self.kc.set_password.assert_called_once_with("kc-adem", NOUVEAU)
        self.assertFalse(CodeReinitialisation.objects.exists())  # code invalidé
        self.assert_erreur(self.reinitialiser(self.code), "code_invalide")  # pas réutilisable

    def test_identifiant_par_email(self):
        self.assertEqual(self.reinitialiser(self.code, identifiant="ADEM@launchpad.local").status_code, 200)

    def test_mauvais_code(self):
        self.assert_erreur(self.reinitialiser(self.faux()), "code_invalide", "Code invalide. Il vous reste 4 essais.")
        self.assertEqual(CodeReinitialisation.objects.get().essais, 1)
        self.kc.set_password.assert_not_called()

    def test_comparaison_en_temps_constant(self):
        with patch("authentication.reinitialisation.hmac.compare_digest", wraps=__import__("hmac").compare_digest) as cmp:
            self.reinitialiser(self.faux())
        cmp.assert_called_once()

    def test_code_expire(self):
        CodeReinitialisation.objects.update(expire_le=timezone.now() - timedelta(seconds=1))
        self.assert_erreur(self.reinitialiser(self.code), "code_expire", "Code expiré. Demandez un nouveau code.")
        self.assertFalse(CodeReinitialisation.objects.exists())
        self.kc.set_password.assert_not_called()

    def test_6_essais_code_annule(self):
        for i in range(1, 5):
            self.assert_erreur(self.reinitialiser(self.faux()), "code_invalide")
        # 5e essai faux : le code est annulé
        self.assert_erreur(self.reinitialiser(self.faux()), "trop_essais",
                           "Trop d'essais : ce code a été annulé. Demandez un nouveau code.")
        # 6e essai, même avec le BON code : refusé
        self.assert_erreur(self.reinitialiser(self.code), "trop_essais")
        self.kc.set_password.assert_not_called()

    def test_nouveau_code_apres_annulation(self):
        for _ in range(5):
            self.reinitialiser(self.faux())
        self.demander()
        self.assertEqual(self.reinitialiser(self.code_recu()).status_code, status.HTTP_200_OK)

    def test_mot_de_passe_faible(self):
        for faible, manque in [("Court@1", "au moins 8 caractères"), ("minuscule@2026", "une majuscule"),
                               ("SansChiffre@", "un chiffre"), ("SansSpecial2026", "un caractère spécial")]:
            with self.subTest(faible):
                response = self.reinitialiser(self.code, faible)
                self.assert_erreur(response, "mot_de_passe_faible")
                self.assertIn(manque, response.json()["error"])
        self.assertEqual(CodeReinitialisation.objects.get().essais, 0)  # aucun essai consommé
        self.kc.set_password.assert_not_called()

    def test_compte_inexistant_ou_sans_code(self):
        self.assert_erreur(self.reinitialiser(self.code, identifiant="personne"), "code_invalide", "Code invalide.")
        CodeReinitialisation.objects.all().delete()
        self.assert_erreur(self.reinitialiser(self.code), "code_invalide", "Code invalide.")

    def test_format_du_code(self):
        response = self.reinitialiser("12ab")
        self.assert_erreur(response, "champs_invalides", "Le code doit contenir 6 chiffres.")

    def test_refus_keycloak_code_conserve(self):
        self.kc.set_password.side_effect = KeycloakPutError("invalidPasswordHistoryMessage", response_code=400)
        self.assert_erreur(self.reinitialiser(self.code), "mot_de_passe_faible")
        self.assertTrue(CodeReinitialisation.objects.exists())  # le code reste utilisable
        self.kc.set_password.side_effect = None
        self.assertEqual(self.reinitialiser(self.code).status_code, status.HTTP_200_OK)

    def test_keycloak_injoignable_503(self):
        self.kc.set_password.side_effect = ConnectionError("Keycloak arrêté")
        self.assertEqual(self.reinitialiser(self.code).status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertTrue(CodeReinitialisation.objects.exists())


class RegleMotDePasseTests(APITestCase):
    def test_criteres(self):
        self.assertEqual(faiblesses_mot_de_passe("Nouveau@2026"), [])
        self.assertEqual(faiblesses_mot_de_passe("abc"),
                         ["au moins 8 caractères", "une majuscule", "un chiffre", "un caractère spécial"])


class KeycloakSetPasswordTests(APITestCase):
    def test_set_password_definitif_et_retire_update_password(self):
        from authentication.keycloak_client import KeycloakService
        service = KeycloakService()
        service._admin = MagicMock()
        service._admin.get_user.return_value = {"requiredActions": ["UPDATE_PASSWORD", "VERIFY_EMAIL"]}
        service.set_password("kc-1", NOUVEAU)
        service._admin.set_user_password.assert_called_once_with(user_id="kc-1", password=NOUVEAU, temporary=False)
        service._admin.update_user.assert_called_once_with("kc-1", {"requiredActions": ["VERIFY_EMAIL"]})

    def test_find_user_by_email_exact(self):
        from authentication.keycloak_client import KeycloakService
        service = KeycloakService()
        service._admin = MagicMock()
        service._admin.get_users.return_value = [{"id": "1", "email": "a@x.tn"}, {"id": "2", "email": "ab@x.tn"}]
        self.assertEqual(service.find_user_by_email("A@x.tn")["id"], "1")
        self.assertIsNone(service.find_user_by_email("c@x.tn"))
