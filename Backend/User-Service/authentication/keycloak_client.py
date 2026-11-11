from django.conf import settings
from keycloak import KeycloakAdmin, KeycloakOpenID

# Rôles du realm qui portent un rôle applicatif (les autres, ex. default-roles-launchpad, sont ignorés)
APP_ROLES = ("ADMIN", "LAWYER", "ACCOUNTANT", "FINANCIER", "ENTREPRENEUR")


class KeycloakService:
    def __init__(self):
        self.server_url = settings.KEYCLOAK_SERVER_URL
        self.realm = settings.KEYCLOAK_REALM
        self.client_id = settings.KEYCLOAK_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_CLIENT_SECRET
        self.admin_user = settings.KEYCLOAK_ADMIN_USER
        self.admin_password = settings.KEYCLOAK_ADMIN_PASSWORD
        self._admin = None

    def get_admin_client(self):
        return KeycloakAdmin(
            server_url=self.server_url,
            username=self.admin_user,
            password=self.admin_password,
            realm_name=self.realm,
            user_realm_name="master",
            verify=True
        )

    @property
    def admin(self):
        """Client d'administration réutilisé pour toutes les opérations d'une même instance."""
        if self._admin is None:
            self._admin = self.get_admin_client()
        return self._admin

    # --- Administration des comptes (synchronisation avec la base) ----------

    def find_user(self, username):
        """Compte Keycloak dont le username est exactement celui-ci, ou None."""
        users = self.admin.get_users({"username": username, "exact": True})
        return users[0] if users else None

    def list_users(self):
        """Tous les comptes du realm (hors comptes de service des clients)."""
        return [u for u in self.admin.get_users({}) if not u.get("serviceAccountClientId")]

    def get_app_roles(self, user_id):
        """Rôles applicatifs (APP_ROLES) affectés au compte dans le realm."""
        return [r["name"] for r in self.admin.get_realm_roles_of_user(user_id) if r["name"] in APP_ROLES]

    def set_app_role(self, user_id, role):
        """Rôle applicatif unique : retire les autres rôles applicatifs et affecte celui-ci."""
        en_trop = [r for r in self.admin.get_realm_roles_of_user(user_id)
                   if r["name"] in APP_ROLES and r["name"] != role]
        if en_trop:
            self.admin.delete_realm_roles_of_user(user_id, en_trop)
        if role not in self.get_app_roles(user_id):
            self.admin.assign_realm_roles(user_id=user_id, roles=[self.admin.get_realm_role(role)])

    def create_account(self, username, email, password, role, first_name="", last_name="", temporary=False):
        """
        Crée le compte (mot de passe + rôle) et renvoie son id. temporary=True : mot de passe
        temporaire et action requise UPDATE_PASSWORD (à changer à la première connexion).
        En cas d'échec de l'affectation du rôle, le compte créé est supprimé.
        """
        payload = {
            "username": username,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": True,
            "attributes": {"role": [role]},
            "credentials": [{"type": "password", "value": password, "temporary": temporary}],
        }
        if temporary:
            payload["requiredActions"] = ["UPDATE_PASSWORD"]
        user_id = self.admin.create_user(payload)
        try:
            self.set_app_role(user_id, role)
        except Exception:
            self.admin.delete_user(user_id)
            raise
        return user_id

    def get_openid_client(self):
        return KeycloakOpenID(
            server_url=self.server_url,
            client_id=self.client_id,
            realm_name=self.realm,
            client_secret_key=self.client_secret,
            verify=True
        )

    def register_user(self, username, email, password, first_name="", last_name="", role="ENTREPRENEUR"):
        """
        Creates user in Keycloak, sets credentials, and assigns role.
        Returns the Keycloak user ID (UUID string).
        """
        return self.create_account(username=username, email=email, password=password, role=role,
                                   first_name=first_name, last_name=last_name)

    def login_user(self, username, password):
        """
        Exchanges username & password for Keycloak tokens (Direct Access Grant).
        """
        openid = self.get_openid_client()
        token_response = openid.token(
            username=username,
            password=password,
            grant_type=["password"]
        )
        return token_response

    def refresh_user_token(self, refresh_token):
        """
        Refreshes an access token using refresh_token.
        """
        openid = self.get_openid_client()
        return openid.refresh_token(refresh_token)

    def logout_user(self, refresh_token):
        """
        Logs out user by invalidating the refresh token.
        """
        openid = self.get_openid_client()
        return openid.logout(refresh_token)

    def verify_token(self, token):
        """
        Decodes and verifies JWT access token from Keycloak.
        """
        openid = self.get_openid_client()
        return openid.decode_token(token, validate=True)

    def get_user_info(self, access_token):
        """
        Fetches user info from Keycloak userinfo endpoint.
        """
        openid = self.get_openid_client()
        return openid.userinfo(access_token)
