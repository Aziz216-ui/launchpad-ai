"""
Aides pour les tests des services (pas utilisées en production).

jeton / connecte : jeton Keycloak factice (non signé) tel que transmis par la gateway.

CsrfTestsMixin : les tests CSRF identiques des 4 services (session admin, POST via la
gateway, origine refusée, jeton exigé, admin Django). Chaque service ne décrit que sa
ressource : URL de création, données valides, modèle et page d'ajout de l'admin.
"""

import base64
import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

GATEWAY = "http://localhost:8090"
# Jeton CSRF fixe (32 caractères alphanumériques) placé dans le cookie et l'en-tête
JETON = "abcdefghijklmnopqrstuvwxyz012345"


def _b64(donnees):
    return base64.urlsafe_b64encode(json.dumps(donnees).encode()).rstrip(b"=").decode()


def jeton(sub, username="", roles=("ENTREPRENEUR",)):
    """JWT non signé (claims Keycloak sub, preferred_username, realm_access.roles) pour les tests."""
    claims = {"sub": sub, "preferred_username": username, "realm_access": {"roles": list(roles)}}
    return f"{_b64({'alg': 'none', 'typ': 'JWT'})}.{_b64(claims)}.signature"


def connecte(sub, username="", roles=("ENTREPRENEUR",)):
    """En-têtes d'une requête transmise par la gateway pour cet utilisateur (client.get(..., **connecte(...)))."""
    return {"HTTP_AUTHORIZATION": f"Bearer {jeton(sub, username, roles)}"}


class CsrfTestsMixin:
    """A combiner avec APITestCase. Attributs à définir dans le service :"""

    url_creation = ""        # nom d'URL de la liste, ex. "secteur-list"
    donnees_creation = {}    # données valides pour un POST
    modele = None            # modèle créé
    champ_texte = ""         # champ du modèle qui reçoit "Test Gateway" / "Depuis l'admin"
    admin_ajout = ""         # ex. "admin:secteurs_secteur_add"
    donnees_admin = {}       # champs du formulaire d'ajout de l'admin (hors champ_texte)

    def setUp(self):
        super().setUp()
        self.admin = get_user_model().objects.create_superuser("admin", "admin@example.com", "motdepasse")
        self.api = APIClient(enforce_csrf_checks=True)
        self.api.force_login(self.admin)
        self.api.cookies[settings.CSRF_COOKIE_NAME] = JETON

    def creer(self, client, texte, **en_tetes):
        donnees = {**self.donnees_creation, self.champ_texte: texte}
        return client.post(reverse(self.url_creation), donnees, format="json", **en_tetes)

    def poster(self, origin, jeton=JETON):
        en_tetes = {"HTTP_ORIGIN": origin}
        if jeton:
            en_tetes["HTTP_X_CSRFTOKEN"] = jeton
        return self.creer(self.api, "Test Gateway", **en_tetes)

    def existe(self, texte):
        return self.modele.objects.filter(**{self.champ_texte: texte}).exists()

    def test_origines_de_confiance_par_defaut(self):
        self.assertIn(GATEWAY, settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn("http://localhost:4200", settings.CSRF_TRUSTED_ORIGINS)
        self.assertIn(f"http://localhost:{settings.SERVICE_PORT}", settings.CSRF_TRUSTED_ORIGINS)

    def test_post_via_la_gateway_avec_session_admin(self):
        response = self.poster(GATEWAY)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertTrue(self.existe("Test Gateway"))

    def test_origine_inconnue_toujours_refusee(self):
        response = self.poster("http://site-malveillant.example")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Origin checking failed", response.json()["detail"])
        self.assertFalse(self.modele.objects.exists())

    def test_jeton_csrf_toujours_exige(self):
        response = self.poster(GATEWAY, jeton=None)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("CSRF", response.json()["detail"])

    def test_sans_session_pas_de_controle_csrf(self):
        # Sans session (ex. frontend sans connexion admin), DRF ne vérifie pas le CSRF
        response = self.creer(APIClient(enforce_csrf_checks=True), "Sans session", HTTP_ORIGIN=GATEWAY)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_connexion_et_ajout_dans_l_admin(self):
        # L'admin Django reste utilisable avec la protection CSRF active
        navigateur = Client(enforce_csrf_checks=True)
        navigateur.get(reverse("admin:login"))
        jeton = navigateur.cookies[settings.CSRF_COOKIE_NAME].value
        response = navigateur.post(reverse("admin:login"), {
            "username": "admin", "password": "motdepasse",
            "csrfmiddlewaretoken": jeton, "next": reverse("admin:index"),
        })
        self.assertRedirects(response, reverse("admin:index"))

        url = reverse(self.admin_ajout)
        self.assertEqual(navigateur.get(url).status_code, 200)
        jeton = navigateur.cookies[settings.CSRF_COOKIE_NAME].value
        response = navigateur.post(url, {**self.donnees_admin, self.champ_texte: "Depuis l'admin",
                                         "csrfmiddlewaretoken": jeton}, HTTP_ORIGIN=GATEWAY)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(self.existe("Depuis l'admin"))
