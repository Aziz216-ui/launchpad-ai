from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions
from django.contrib.auth import get_user_model
from .keycloak_client import KeycloakService

User = get_user_model()

class KeycloakAuthentication(BaseAuthentication):
    def __init__(self):
        self.keycloak_service = KeycloakService()

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

        keycloak_id = payload.get("sub")
        username = payload.get("preferred_username") or payload.get("username")
        email = payload.get("email", "")
        roles = payload.get("realm_access", {}).get("roles", [])

        # Map role
        role = User.Role.USER
        if "admin" in roles:
            role = User.Role.ADMIN
        elif "lawyer" in roles:
            role = User.Role.LAWYER

        # Get or create local user
        user, created = User.objects.get_or_create(
            keycloak_id=keycloak_id,
            defaults={
                "username": username or keycloak_id,
                "email": email or f"{keycloak_id}@example.com",
                "first_name": payload.get("given_name", ""),
                "last_name": payload.get("family_name", ""),
                "role": role,
            }
        )

        return (user, token)
