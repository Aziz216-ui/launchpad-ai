"""
Tests de la synchronisation Keycloak <-> base (Keycloak mocké) :
seed_demo_users, sync_keycloak, provisioning à la connexion et KeycloakService.
"""
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from authentication.keycloak_client import KeycloakService

User = get_user_model()

SEED = "authentication.management.commands.seed_demo_users.KeycloakService"
SYNC = "authentication.management.commands.sync_keycloak.KeycloakService"


class FauxKeycloak:
    """Keycloak en mémoire avec la même interface que KeycloakService."""

    def __init__(self):
        self.comptes = {}  # id -> {"id", "username", "email", "firstName", "lastName", "roles", "password", ...}
        self.crees = []    # arguments des create_account
        self._n = 0

    def ajouter(self, username, role=None, email=None):
        self._n += 1
        compte = {"id": f"kc-{self._n}", "username": username.lower(),
                  "email": email or f"{username}@exemple.tn", "firstName": "", "lastName": "",
                  "roles": [role] if role else [], "password": "x", "temporary": False}
        self.comptes[compte["id"]] = compte
        return compte["id"]

    # --- Interface de KeycloakService ---
    def find_user(self, username):
        return next((c for c in self.comptes.values() if c["username"] == username.lower()), None)

    def list_users(self):
        return list(self.comptes.values())

    def get_app_roles(self, user_id):
        return list(self.comptes[user_id]["roles"])

    def set_app_role(self, user_id, role):
        self.comptes[user_id]["roles"] = [role]

    def set_password(self, user_id, password):
        self.comptes[user_id].update(password=password, temporary=False)

    def create_account(self, username, email, password, role, first_name="", last_name="", temporary=False):
        self.crees.append({"username": username, "password": password, "role": role, "temporary": temporary})
        user_id = self.ajouter(username, role, email)
        self.comptes[user_id].update(password=password, temporary=temporary)
        return user_id


def profil(username, keycloak_id, role=User.Role.ENTREPRENEUR, email=None):
    return User.objects.create(username=username, keycloak_id=keycloak_id, role=role,
                               email=email or f"{username}@launchpad.local")


def lancer(commande, faux, *args):
    sortie = StringIO()
    cible = SEED if commande == "seed_demo_users" else SYNC
    with patch(cible, return_value=faux):
        call_command(commande, *args, stdout=sortie)
    return sortie.getvalue()


# --- seed_demo_users ---------------------------------------------------------------

class SeedDemoUsersTests(TestCase):
    def setUp(self):
        self.kc = FauxKeycloak()

    def test_tout_absent_cree_les_deux_cotes(self):
        lancer("seed_demo_users", self.kc)
        self.assertEqual(User.objects.count(), 5)
        self.assertEqual(len(self.kc.comptes), 5)
        adem = User.objects.get(username="adem")
        self.assertEqual(adem.keycloak_id, self.kc.find_user("adem")["id"])
        self.assertEqual(self.kc.get_app_roles(adem.keycloak_id), ["ENTREPRENEUR"])

    def test_manquant_dans_keycloak_recree_et_keycloak_id_mis_a_jour(self):
        # Le cas constaté : adem en base, plus dans Keycloak (Keycloak réinitialisé)
        profil("adem", "ancien-id")
        sortie = lancer("seed_demo_users", self.kc)
        compte = self.kc.find_user("adem")
        self.assertIsNotNone(compte)
        self.assertEqual(compte["roles"], ["ENTREPRENEUR"])
        self.assertEqual((compte["password"], compte["temporary"]), ("Adem@2026!", False))
        self.assertEqual(User.objects.filter(username="adem").count(), 1)  # pas de doublon
        self.assertEqual(User.objects.get(username="adem").keycloak_id, compte["id"])
        self.assertIn("'adem' : créé dans Keycloak", sortie)
        self.assertIn("keycloak_id corrigé : ancien-id", sortie)

    def test_manquant_en_base_cree_le_profil(self):
        kc_id = self.kc.ajouter("ahmed", "ADMIN")
        sortie = lancer("seed_demo_users", self.kc)
        ahmed = User.objects.get(username="ahmed")
        self.assertEqual((ahmed.keycloak_id, ahmed.role), (kc_id, "ADMIN"))
        self.assertEqual(len([c for c in self.kc.crees if c["username"] == "ahmed"]), 0)  # pas recréé
        self.assertIn("'ahmed' : profil créé en base", sortie)

    def test_role_different_corrige_des_deux_cotes(self):
        kc_id = self.kc.ajouter("adem", "ADMIN")
        profil("adem", kc_id, role=User.Role.LAWYER)
        lancer("seed_demo_users", self.kc)
        self.assertEqual(self.kc.get_app_roles(kc_id), ["ENTREPRENEUR"])
        self.assertEqual(User.objects.get(username="adem").role, "ENTREPRENEUR")

    def test_mot_de_passe_modifie_reapplique(self):
        # Le cas constaté : mot de passe d'adem changé par un test de « Mot de passe oublié »
        lancer("seed_demo_users", self.kc)
        compte = self.kc.find_user("adem")
        compte.update(password="ChangeParTest!1")
        lancer("seed_demo_users", self.kc)
        self.assertEqual((compte["password"], compte["temporary"]), ("Adem@2026!", False))

    def test_dry_run_ne_reapplique_pas_le_mot_de_passe(self):
        kc_id = self.kc.ajouter("adem", "ENTREPRENEUR")
        lancer("seed_demo_users", self.kc, "--dry-run")
        self.assertEqual(self.kc.comptes[kc_id]["password"], "x")

    def test_idempotent(self):
        lancer("seed_demo_users", self.kc)
        sortie = lancer("seed_demo_users", self.kc)
        self.assertEqual((User.objects.count(), len(self.kc.comptes)), (5, 5))
        self.assertEqual(sortie.count("déjà synchronisé"), 5)

    def test_dry_run_ne_modifie_rien(self):
        profil("adem", "ancien-id")
        sortie = lancer("seed_demo_users", self.kc, "--dry-run")
        self.assertEqual(self.kc.comptes, {})
        self.assertEqual(User.objects.get(username="adem").keycloak_id, "ancien-id")
        self.assertIn("[dry-run] créé dans Keycloak", sortie)


# --- sync_keycloak -----------------------------------------------------------------

class SyncKeycloakTests(TestCase):
    def setUp(self):
        self.kc = FauxKeycloak()

    def test_manquant_dans_keycloak_mot_de_passe_temporaire(self):
        profil("bob", "ancien-id", role=User.Role.FINANCIER)
        sortie = lancer("sync_keycloak", self.kc)
        cree = self.kc.crees[0]
        self.assertEqual((cree["username"], cree["role"], cree["temporary"]), ("bob", "FINANCIER", True))
        bob = User.objects.get(username="bob")
        self.assertEqual(bob.keycloak_id, self.kc.find_user("bob")["id"])
        self.assertIn("mot de passe temporaire, UPDATE_PASSWORD", sortie)
        self.assertIn(cree["password"], sortie)  # transmis une seule fois, dans le rapport

    def test_compte_demo_manquant_garde_son_mot_de_passe_de_demo(self):
        profil("adem", "ancien-id")
        sortie = lancer("sync_keycloak", self.kc)
        self.assertEqual(self.kc.crees[0]["password"], "Adem@2026!")
        self.assertFalse(self.kc.crees[0]["temporary"])
        self.assertNotIn("Mots de passe temporaires", sortie)

    def test_manquant_en_base_profil_cree_avec_le_role_keycloak(self):
        kc_id = self.kc.ajouter("carla", "ACCOUNTANT", email="carla@exemple.tn")
        lancer("sync_keycloak", self.kc)
        carla = User.objects.get(username="carla")
        self.assertEqual((carla.keycloak_id, carla.role, carla.email), (kc_id, "ACCOUNTANT", "carla@exemple.tn"))

    def test_role_different_keycloak_fait_foi(self):
        kc_id = self.kc.ajouter("dora", "LAWYER")
        profil("dora", kc_id, role=User.Role.ENTREPRENEUR)
        sortie = lancer("sync_keycloak", self.kc)
        self.assertEqual(User.objects.get(username="dora").role, "LAWYER")
        self.assertEqual(self.kc.get_app_roles(kc_id), ["LAWYER"])
        self.assertIn("rôle en base corrigé : ENTREPRENEUR -> LAWYER", sortie)

    def test_compte_keycloak_sans_role_recoit_le_role_de_la_base(self):
        kc_id = self.kc.ajouter("eva")
        profil("eva", kc_id, role=User.Role.FINANCIER)
        lancer("sync_keycloak", self.kc)
        self.assertEqual(self.kc.get_app_roles(kc_id), ["FINANCIER"])
        self.assertEqual(User.objects.get(username="eva").role, "FINANCIER")

    def test_role_d_un_compte_demo_impose(self):
        kc_id = self.kc.ajouter("ahmed", "ENTREPRENEUR")
        profil("ahmed", kc_id, role=User.Role.ENTREPRENEUR)
        lancer("sync_keycloak", self.kc)
        self.assertEqual(self.kc.get_app_roles(kc_id), ["ADMIN"])
        self.assertEqual(User.objects.get(username="ahmed").role, "ADMIN")

    def test_keycloak_id_corrige_par_username(self):
        kc_id = self.kc.ajouter("fred", "ENTREPRENEUR")
        profil("Fred", "ancien-id")  # Keycloak stocke les usernames en minuscules
        lancer("sync_keycloak", self.kc)
        self.assertEqual(User.objects.get(username="Fred").keycloak_id, kc_id)
        self.assertEqual(self.kc.crees, [])
        self.assertEqual(User.objects.count(), 1)

    def test_deja_synchronise(self):
        kc_id = self.kc.ajouter("gina", "ENTREPRENEUR")
        profil("gina", kc_id)
        sortie = lancer("sync_keycloak", self.kc)
        self.assertIn("Aucun écart", sortie)

    def test_dry_run_ne_modifie_rien(self):
        profil("bob", "ancien-id")
        kc_id = self.kc.ajouter("dora", "LAWYER")
        profil("dora", kc_id)
        self.kc.ajouter("carla", "ACCOUNTANT")
        sortie = lancer("sync_keycloak", self.kc, "--dry-run")
        self.assertEqual(self.kc.crees, [])
        self.assertEqual(User.objects.get(username="bob").keycloak_id, "ancien-id")
        self.assertEqual(User.objects.get(username="dora").role, "ENTREPRENEUR")
        self.assertFalse(User.objects.filter(username="carla").exists())
        self.assertIn("dry-run : aucune modification", sortie)
        self.assertEqual(sortie.count("[dry-run]"), 3)

    def test_email_deja_pris_adresse_de_remplacement(self):
        profil("autre", "kc-autre", email="carla@exemple.tn")
        self.kc.comptes["kc-autre"] = {"id": "kc-autre", "username": "autre", "email": "carla@exemple.tn",
                                       "roles": ["ENTREPRENEUR"]}
        kc_id = self.kc.ajouter("carla", "ACCOUNTANT", email="carla@exemple.tn")
        lancer("sync_keycloak", self.kc)
        self.assertEqual(User.objects.get(username="carla").email, f"{kc_id}@keycloak.invalid")


# --- Provisioning à la connexion -----------------------------------------------------

def jeton(sub, username, roles=("ENTREPRENEUR",), email=None):
    return {"sub": sub, "preferred_username": username, "email": email or f"{username}@exemple.tn",
            "given_name": username.title(), "family_name": "Test", "realm_access": {"roles": list(roles)}}


class LoginProvisioningTests(APITestCase):
    url = "/api/auth/login/"

    def connecter(self, mock_keycloak, payload):
        mock_keycloak.return_value.login_user.return_value = {"access_token": "a", "refresh_token": "r"}
        mock_keycloak.return_value.verify_token.return_value = payload
        return self.client.post(self.url, {"username": payload["preferred_username"], "password": "p"},
                                format="json")

    @patch("authentication.views.KeycloakService")
    def test_profil_absent_cree_depuis_le_jeton(self, mock_keycloak):
        response = self.connecter(mock_keycloak, jeton("kc-9", "hana", roles=["default-roles-launchpad", "LAWYER"]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hana = User.objects.get(username="hana")
        self.assertEqual((hana.keycloak_id, hana.role, hana.email, hana.first_name),
                         ("kc-9", "LAWYER", "hana@exemple.tn", "Hana"))
        self.assertEqual(response.data["user"]["username"], "hana")

    @patch("authentication.views.KeycloakService")
    def test_profil_existant_relie_au_nouveau_compte(self, mock_keycloak):
        profil("adem", "ancien-id")
        response = self.connecter(mock_keycloak, jeton("nouveau-id", "adem"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(username="adem").count(), 1)
        self.assertEqual(User.objects.get(username="adem").keycloak_id, "nouveau-id")

    @patch("authentication.views.KeycloakService")
    def test_role_aligne_sur_le_jeton(self, mock_keycloak):
        profil("ines", "kc-5", role=User.Role.ENTREPRENEUR)
        self.connecter(mock_keycloak, jeton("kc-5", "ines", roles=["ACCOUNTANT"]))
        self.assertEqual(User.objects.get(username="ines").role, "ACCOUNTANT")

    @patch("authentication.views.KeycloakService")
    def test_jeton_illisible_connexion_quand_meme(self, mock_keycloak):
        profil("jade", "kc-6")
        mock_keycloak.return_value.login_user.return_value = {"access_token": "a"}
        mock_keycloak.return_value.verify_token.side_effect = Exception("certs indisponibles")
        response = self.client.post(self.url, {"username": "jade", "password": "p"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "jade")


class AuthenticationProvisioningTests(APITestCase):
    @patch("authentication.authentication.KeycloakService")
    def test_jeton_d_un_keycloak_reinitialise_sans_doublon(self, mock_keycloak):
        # Avant : get_or_create par keycloak_id -> IntegrityError (username déjà pris) -> 500
        profil("adem", "ancien-id")
        mock_keycloak.return_value.verify_token.return_value = jeton("nouveau-id", "adem")
        response = self.client.get("/api/auth/profile/", HTTP_AUTHORIZATION="Bearer t")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.filter(username="adem").count(), 1)
        self.assertEqual(User.objects.get(username="adem").keycloak_id, "nouveau-id")


# --- KeycloakService (KeycloakAdmin mocké) ---------------------------------------------

class KeycloakServiceTests(TestCase):
    def setUp(self):
        self.service = KeycloakService()
        self.admin = MagicMock()
        self.service._admin = self.admin
        self.roles = {n: {"id": n.lower(), "name": n} for n in ("ADMIN", "ENTREPRENEUR", "default-roles-launchpad")}
        self.admin.get_realm_role.side_effect = lambda nom: self.roles[nom]

    def test_set_app_role_retire_les_autres_roles_applicatifs(self):
        self.admin.get_realm_roles_of_user.side_effect = [
            [self.roles["ADMIN"], self.roles["default-roles-launchpad"]],  # avant retrait
            [self.roles["default-roles-launchpad"]],                       # après retrait
        ]
        self.service.set_app_role("u1", "ENTREPRENEUR")
        self.admin.delete_realm_roles_of_user.assert_called_once_with("u1", [self.roles["ADMIN"]])
        self.admin.assign_realm_roles.assert_called_once_with(user_id="u1", roles=[self.roles["ENTREPRENEUR"]])

    def test_create_account_temporaire(self):
        self.admin.create_user.return_value = "u2"
        self.admin.get_realm_roles_of_user.return_value = []
        self.assertEqual(self.service.create_account("bob", "b@x.tn", "tmp", "ENTREPRENEUR", temporary=True), "u2")
        payload = self.admin.create_user.call_args.args[0]
        self.assertEqual(payload["requiredActions"], ["UPDATE_PASSWORD"])
        self.assertEqual(payload["credentials"], [{"type": "password", "value": "tmp", "temporary": True}])

    def test_create_account_supprime_le_compte_si_le_role_echoue(self):
        self.admin.create_user.return_value = "u3"
        self.admin.get_realm_roles_of_user.return_value = []
        self.admin.get_realm_role.side_effect = Exception("rôle inexistant")
        with self.assertRaises(Exception):
            self.service.create_account("bob", "b@x.tn", "p", "FINANCIER")
        self.admin.delete_user.assert_called_once_with("u3")

    def test_list_users_ignore_les_comptes_de_service(self):
        self.admin.get_users.return_value = [{"id": "1", "username": "a"},
                                             {"id": "2", "username": "service-account-x",
                                              "serviceAccountClientId": "launchpad-client"}]
        self.assertEqual([u["id"] for u in self.service.list_users()], ["1"])
