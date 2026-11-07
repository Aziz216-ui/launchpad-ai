import os
from django.conf import settings
from keycloak import KeycloakAdmin, KeycloakOpenID
from keycloak.exceptions import KeycloakError

class KeycloakService:
    def __init__(self):
        self.server_url = settings.KEYCLOAK_SERVER_URL
        self.realm = settings.KEYCLOAK_REALM
        self.client_id = settings.KEYCLOAK_CLIENT_ID
        self.client_secret = settings.KEYCLOAK_CLIENT_SECRET
        self.admin_user = settings.KEYCLOAK_ADMIN_USER
        self.admin_password = settings.KEYCLOAK_ADMIN_PASSWORD

    def get_admin_client(self):
        return KeycloakAdmin(
            server_url=self.server_url,
            username=self.admin_user,
            password=self.admin_password,
            realm_name=self.realm,
            user_realm_name="master",
            verify=True
        )

    def get_openid_client(self):
        return KeycloakOpenID(
            server_url=self.server_url,
            client_id=self.client_id,
            realm_name=self.realm,
            client_secret_key=self.client_secret,
            verify=True
        )

    def register_user(self, username, email, password, first_name="", last_name="", role="user"):
        """
        Creates user in Keycloak, sets credentials, and assigns role.
        Returns the Keycloak user ID (UUID string).
        """
        admin = self.get_admin_client()
        user_payload = {
            "username": username,
            "email": email,
            "firstName": first_name,
            "lastName": last_name,
            "enabled": True,
            "emailVerified": True,
            "attributes": {
                "role": [role]
            }
        }
        
        # 1. Create user
        user_id = admin.create_user(user_payload)
        
        # 2. Set user password
        admin.set_user_password(user_id=user_id, password=password, temporary=False)

        # 3. Assign realm role
        try:
            realm_roles = admin.get_realm_roles()
            target_role = next((r for r in realm_roles if r["name"] == role), None)
            if target_role:
                admin.assign_realm_roles(user_id=user_id, roles=[target_role])
        except Exception as e:
            # If role assignment fails, cleanup user and re-raise
            admin.delete_user(user_id)
            raise e

        return user_id

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
