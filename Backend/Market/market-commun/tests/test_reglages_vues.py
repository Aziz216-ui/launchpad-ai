"""Tests des réglages communs (secrets), du health check et du gestionnaire d'erreurs 503."""

from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from market_commun import reglages

SERVICE = dict(base_dir=".", nom="x-service", port=8020, app="x", ressource="x", eureka_app="X-SERVICE",
               nom_base="x_db", titre="X", description="X",
               services_appeles={"Y-SERVICE": ("Y_SERVICE_URL", 8021)})


def environnement(**variables):
    """Environnement isolé (sans .env) pour construire les réglages."""
    return mock.patch.dict("os.environ", variables, clear=True)


@mock.patch("market_commun.reglages.load_dotenv")
class SecretsTests(SimpleTestCase):
    def test_production_sans_secret_refuse_de_demarrer(self, load_dotenv):
        for manquant in ("SECRET_KEY", "DB_PASSWORD", "RABBITMQ_PASSWORD"):
            variables = {"DEBUG": "False", "SECRET_KEY": "s", "DB_PASSWORD": "d", "RABBITMQ_PASSWORD": "r"}
            del variables[manquant]
            with self.subTest(manquant=manquant), environnement(**variables), \
                    self.assertRaisesMessage(ImproperlyConfigured, manquant):
                reglages.reglages_service(**SERVICE)

    def test_production_avec_les_variables(self, load_dotenv):
        with environnement(DEBUG="False", SECRET_KEY="cle", DB_PASSWORD="mdp", RABBITMQ_PASSWORD="rmq"):
            r = reglages.reglages_service(**SERVICE)
        self.assertEqual(r["SECRET_KEY"], "cle")
        self.assertEqual(r["DATABASES"]["default"]["PASSWORD"], "mdp")
        self.assertEqual(r["RABBITMQ_PASSWORD"], "rmq")
        self.assertFalse(r["DEBUG"])

    def test_dev_sans_variable(self, load_dotenv):
        with environnement(DEBUG="True"):
            r = reglages.reglages_service(**SERVICE)
        self.assertGreater(len(r["SECRET_KEY"]), 40)  # clé aléatoire, jamais une valeur écrite dans le code
        self.assertEqual(r["DATABASES"]["default"]["PASSWORD"], "")

    def test_valeurs_du_service(self, load_dotenv):
        with environnement(DEBUG="True"):
            r = reglages.reglages_service(**SERVICE)
        self.assertEqual(r["SERVICES_URLS"], {"Y-SERVICE": "http://localhost:8021"})
        self.assertIn("http://localhost:8020", r["CSRF_TRUSTED_ORIGINS"])
        self.assertEqual((r["EUREKA_APP_NAME"], r["EUREKA_INSTANCE_PORT"]), ("X-SERVICE", 8020))
        self.assertEqual(r["EUREKA_HEALTH_PATH"], "/api/market/x/health/")
        self.assertEqual(r["INSTALLED_APPS"][-1], "x")


class VuesCommunesTests(SimpleTestCase):
    def test_health(self):
        response = self.client.get("/api/market/objets/health/")
        self.assertEqual(response.json(), {"status": "UP", "service": "test-service"})

    def test_service_appele_arrete_503_json(self):
        response = self.client.get("/api/market/panne/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"service": "AUTRE-SERVICE", "message": "Service indisponible"})

    def test_swagger(self):
        self.assertEqual(self.client.get("/api/market/objets/docs/").status_code, 200)
