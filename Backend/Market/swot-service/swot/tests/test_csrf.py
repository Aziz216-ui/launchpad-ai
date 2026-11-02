"""Tests du CSRF avec une session admin active (POST depuis Swagger via l'API Gateway)."""

from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from swot.models import ElementSWOT

GATEWAY = "http://localhost:8090"
# Jeton CSRF fixe (32 caractères alphanumériques) placé dans le cookie et l'en-tête
JETON = "abcdefghijklmnopqrstuvwxyz012345"


class CsrfSessionTestCase(APITestCase):
    """Comme Swagger : session admin + cookie csrftoken + en-tête X-CSRFToken + Origin."""

    def setUp(self):
        # ETUDE-SERVICE simulé : l'étude 1 existe
        patcher = mock.patch("clients.etude_client.EtudeClient.exists", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.admin = get_user_model().objects.create_superuser("admin", "admin@example.com", "motdepasse")
        self.api = APIClient(enforce_csrf_checks=True)
        self.api.force_login(self.admin)
        self.api.cookies[settings.CSRF_COOKIE_NAME] = JETON

    def poster(self, origin, jeton=JETON):
        en_tetes = {"HTTP_ORIGIN": origin}
        if jeton:
            en_tetes["HTTP_X_CSRFTOKEN"] = jeton
        return self.api.post(reverse("swot-list"), {"etude_id": 1, "type": "force", "description": "Test Gateway"},
                             format="json", **en_tetes)

    def test_origines_de_confiance_par_defaut(self):
        self.assertIn(GATEWAY, settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://localhost:4200", settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://localhost:8013", settings.CSRF_TRUSTED_ORIGINS)

    def test_post_via_la_gateway_avec_session_admin(self):
        response = self.poster(GATEWAY)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertTrue(ElementSWOT.objects.filter(description="Test Gateway").exists())

    def test_origine_inconnue_toujours_refusee(self):
        response = self.poster("http://site-malveillant.example")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Origin checking failed", response.json()["detail"])
        self.assertFalse(ElementSWOT.objects.exists())

    def test_jeton_csrf_toujours_exige(self):
        response = self.poster(GATEWAY, jeton=None)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("CSRF", response.json()["detail"])

    def test_sans_session_pas_de_controle_csrf(self):
        # Sans session (ex. frontend sans connexion admin), DRF ne vérifie pas le CSRF
        response = APIClient(enforce_csrf_checks=True).post(
            reverse("swot-list"), {"etude_id": 1, "type": "force", "description": "Sans session"}, format="json", HTTP_ORIGIN=GATEWAY)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class AdminCsrfTestCase(APITestCase):
    """L'admin Django reste utilisable avec la protection CSRF active."""

    def setUp(self):
        get_user_model().objects.create_superuser("admin", "admin@example.com", "motdepasse")
        self.navigateur = Client(enforce_csrf_checks=True)

    def test_connexion_et_ajout_dans_l_admin(self):
        # Connexion : jeton lu dans le formulaire de la page de login
        self.navigateur.get(reverse("admin:login"))
        jeton = self.navigateur.cookies[settings.CSRF_COOKIE_NAME].value
        response = self.navigateur.post(reverse("admin:login"), {
            "username": "admin", "password": "motdepasse",
            "csrfmiddlewaretoken": jeton, "next": reverse("admin:index"),
        })
        self.assertRedirects(response, reverse("admin:index"))

        # Ajout d'un élément SWOT depuis l'admin, ouvert via la gateway
        url = reverse("admin:swot_elementswot_add")
        self.assertEqual(self.navigateur.get(url).status_code, 200)
        jeton = self.navigateur.cookies[settings.CSRF_COOKIE_NAME].value
        response = self.navigateur.post(url, {"etude_id": "1", "type": "force", "description": "Depuis l'admin",
                                              "csrfmiddlewaretoken": jeton},
                                        HTTP_ORIGIN=GATEWAY)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(ElementSWOT.objects.filter(description="Depuis l'admin").exists())
