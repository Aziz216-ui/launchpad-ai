from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from .keycloak_client import KeycloakService
from .synchronisation import provisionner_profil

class KeycloakAuthentication(BaseAuthentication):
    def __init__(self):
        self.keycloak_service = KeycloakService()

    def authenticate_header(self, request):
        # Without this, DRF returns 403 instead of 401 when no/invalid token is
        # supplied (it only adds the WWW-Authenticate header, which triggers 401,
        # when the authenticator defines this method).
        return 'Bearer realm="launchpad"'

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]

        try:
            payload = self.keycloak_service.verify_token(token)
        except Exception as e:
            raise exceptions.AuthenticationFailed(f"Invalid token: {str(e)}")

        if not payload.get("sub"):
            raise exceptions.AuthenticationFailed("Invalid token: missing 'sub' claim")

        # Profil local trouvé par keycloak_id, sinon relié par username (Keycloak réinitialisé),
        # sinon créé ; rôle aligné sur le jeton (Keycloak est la source de vérité).
        user = provisionner_profil(payload)
        return (user, token)
