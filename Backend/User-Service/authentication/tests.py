from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from keycloak.exceptions import KeycloakError
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterViewTests(APITestCase):
    url = "/api/auth/register/"

    @patch("authentication.views.KeycloakService")
    def test_register_success(self, mock_keycloak_service):
        mock_keycloak_service.return_value.register_user.return_value = "kc-uuid-1"

        response = self.client.post(
            self.url,
            {
                "username": "alice",
                "email": "alice@example.com",
                "password": "secret123",
                "role": User.Role.ENTREPRENEUR,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="alice", keycloak_id="kc-uuid-1").exists())

    @patch("authentication.views.KeycloakService")
    def test_register_duplicate_username_rejected(self, mock_keycloak_service):
        User.objects.create(keycloak_id="existing-id", username="alice", email="old@example.com")

        response = self.client.post(
            self.url,
            {
                "username": "alice",
                "email": "new@example.com",
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        mock_keycloak_service.return_value.register_user.assert_not_called()

    @patch("authentication.views.KeycloakService")
    def test_register_keycloak_error_returns_400(self, mock_keycloak_service):
        mock_keycloak_service.return_value.register_user.side_effect = KeycloakError("username taken")

        response = self.client.post(
            self.url,
            {
                "username": "bob",
                "email": "bob@example.com",
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username="bob").exists())


class LoginViewTests(APITestCase):
    url = "/api/auth/login/"

    @patch("authentication.views.KeycloakService")
    def test_login_success_returns_tokens(self, mock_keycloak_service):
        User.objects.create(keycloak_id="kc-uuid-2", username="alice", email="alice@example.com")
        mock_keycloak_service.return_value.login_user.return_value = {
            "access_token": "access-token",
            "refresh_token": "refresh-token",
            "token_type": "Bearer",
            "expires_in": 300,
            "refresh_expires_in": 1800,
        }

        response = self.client.post(self.url, {"username": "alice", "password": "secret123"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["access_token"], "access-token")
        self.assertEqual(response.data["refresh_token"], "refresh-token")
        self.assertEqual(response.data["user"]["username"], "alice")

    @patch("authentication.views.KeycloakService")
    def test_login_invalid_credentials_returns_401(self, mock_keycloak_service):
        mock_keycloak_service.return_value.login_user.side_effect = KeycloakError("invalid_grant")

        response = self.client.post(self.url, {"username": "alice", "password": "wrong"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RefreshTokenViewTests(APITestCase):
    url = "/api/auth/refresh/"

    @patch("authentication.views.KeycloakService")
    def test_refresh_success(self, mock_keycloak_service):
        mock_keycloak_service.return_value.refresh_user_token.return_value = {
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
        }

        response = self.client.post(self.url, {"refresh_token": "old-refresh-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["access_token"], "new-access-token")

    @patch("authentication.views.KeycloakService")
    def test_refresh_invalid_token_returns_400(self, mock_keycloak_service):
        mock_keycloak_service.return_value.refresh_user_token.side_effect = KeycloakError("invalid_grant")

        response = self.client.post(self.url, {"refresh_token": "bad-token"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserProfileViewTests(APITestCase):
    url = "/api/auth/profile/"

    def test_profile_without_token_returns_401(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("authentication.authentication.KeycloakService")
    def test_profile_with_valid_token_returns_200(self, mock_keycloak_service):
        mock_keycloak_service.return_value.verify_token.return_value = {
            "sub": "kc-uuid-3",
            "preferred_username": "carol",
            "email": "carol@example.com",
            "given_name": "Carol",
            "family_name": "Smith",
            "realm_access": {"roles": ["ENTREPRENEUR"]},
        }

        response = self.client.get(self.url, HTTP_AUTHORIZATION="Bearer fake-access-token")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "carol")
        self.assertTrue(User.objects.filter(keycloak_id="kc-uuid-3", username="carol").exists())

    @patch("authentication.authentication.KeycloakService")
    def test_profile_with_invalid_token_returns_401(self, mock_keycloak_service):
        mock_keycloak_service.return_value.verify_token.side_effect = Exception("invalid signature")

        response = self.client.get(self.url, HTTP_AUTHORIZATION="Bearer bad-token")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class HealthCheckViewTests(APITestCase):
    url = "/api/auth/health/"

    @patch("authentication.views.KeycloakService")
    def test_health_check_healthy(self, mock_keycloak_service):
        mock_keycloak_service.return_value.get_openid_client.return_value = MagicMock()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "healthy")
        self.assertTrue(response.data["database_connected"])
        self.assertTrue(response.data["keycloak_connected"])

    @patch("authentication.views.KeycloakService")
    def test_health_check_degraded_when_keycloak_unreachable(self, mock_keycloak_service):
        mock_keycloak_service.return_value.get_openid_client.side_effect = Exception("connection refused")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["status"], "degraded")
        self.assertFalse(response.data["keycloak_connected"])
