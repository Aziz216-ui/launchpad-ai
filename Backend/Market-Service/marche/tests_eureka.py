"""Tests de l'enregistrement Eureka (marche/eureka.py), sans serveur Eureka réel."""

from unittest import mock

from django.test import SimpleTestCase, override_settings

from . import eureka

GUNICORN = ["/usr/local/bin/gunicorn", "config.wsgi:application", "--preload"]


class EstUnServeurTests(SimpleTestCase):
    def test_gunicorn(self):
        self.assertTrue(eureka.est_un_serveur(GUNICORN, {}))

    def test_runserver_processus_enfant_de_l_autoreload(self):
        self.assertTrue(eureka.est_un_serveur(["manage.py", "runserver", "8005"], {"RUN_MAIN": "true"}))

    def test_runserver_processus_parent_de_l_autoreload(self):
        self.assertFalse(eureka.est_un_serveur(["manage.py", "runserver", "8005"], {}))

    def test_runserver_sans_autoreload(self):
        self.assertTrue(eureka.est_un_serveur(["manage.py", "runserver", "--noreload"], {}))

    def test_autres_commandes_manage_py(self):
        for commande in ["migrate", "test", "shell", "seed_marche", "collectstatic", "makemigrations"]:
            with self.subTest(commande=commande):
                self.assertFalse(eureka.est_un_serveur(["manage.py", commande], {"RUN_MAIN": "true"}))

    def test_sans_argument(self):
        self.assertFalse(eureka.est_un_serveur([], {}))


@override_settings(EUREKA_ENABLED=True, EUREKA_SERVER_URL="http://eureka:8761/eureka/",
                   EUREKA_INSTANCE_HOST="localhost")
class DemarrerTests(SimpleTestCase):
    def setUp(self):
        # État du module remis à zéro, aucun handler atexit réel ni vrai appel réseau
        for nom, valeur in [("_demarre", False), ("_injoignable", False), ("_arrete", False)]:
            patcher = mock.patch.object(eureka, nom, valeur)
            patcher.start()
            self.addCleanup(patcher.stop)
        patcher = mock.patch("atexit.register")
        self.atexit_register = patcher.start()
        self.addCleanup(patcher.stop)
        patcher = mock.patch("py_eureka_client.logger.set_level")
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = mock.patch("py_eureka_client.eureka_client.init")
        self.init = patcher.start()
        self.addCleanup(patcher.stop)

    def demarrer(self, argv=GUNICORN):
        with mock.patch.object(eureka.sys, "argv", argv):
            eureka.demarrer()

    def test_enregistrement_market_service(self):
        with self.assertLogs("marche.eureka", level="INFO") as logs:
            self.demarrer()
        self.assertIn("sous MARKET-SERVICE", logs.output[0])
        self.init.assert_called_once()
        options = self.init.call_args.kwargs
        self.assertEqual(options["eureka_server"], "http://eureka:8761/eureka/")
        self.assertEqual(options["app_name"], "MARKET-SERVICE")
        self.assertEqual(options["instance_id"], "localhost:market-service:8005")
        self.assertEqual(options["instance_host"], "localhost")
        self.assertEqual(options["instance_port"], 8005)
        self.assertEqual(options["health_check_url"], "http://localhost:8005/api/market/health/")
        self.assertFalse(options["should_discover"])

    def test_une_seule_fois(self):
        with self.assertLogs("marche.eureka", level="INFO"):
            self.demarrer()
            self.demarrer()
        self.init.assert_called_once()

    @override_settings(EUREKA_ENABLED=False)
    def test_desactive_par_defaut(self):
        self.demarrer()
        self.init.assert_not_called()

    def test_jamais_pendant_migrate_ou_test(self):
        for commande in ["migrate", "test"]:
            self.demarrer(["manage.py", commande])
        self.init.assert_not_called()

    def test_erreur_d_initialisation_n_empeche_pas_le_demarrage(self):
        self.init.side_effect = OSError("connexion refusée")
        with self.assertLogs("marche.eureka", level="WARNING") as logs:
            self.demarrer()
        self.assertIn("connexion refusée", logs.output[0])

    def test_eureka_injoignable_un_seul_avertissement(self):
        def init_injoignable(**options):
            options["on_error"]("register_error", ConnectionRefusedError("refus"))
            options["on_error"]("register_error", ConnectionRefusedError("refus"))

        self.init.side_effect = init_injoignable
        with self.assertLogs("marche.eureka", level="WARNING") as logs:
            self.demarrer()
        avertissements = [ligne for ligne in logs.output if ligne.startswith("WARNING")]
        self.assertEqual(len(avertissements), 1)
        self.assertIn("Eureka injoignable (http://eureka:8761/eureka/)", avertissements[0])

    @mock.patch("urllib.request.urlopen")
    def test_desenregistrement_a_l_arret(self, urlopen):
        with self.assertLogs("marche.eureka", level="INFO"):
            self.demarrer()
            arreter = self.atexit_register.call_args.args[0]
            arreter()
        requete = urlopen.call_args.args[0]
        self.assertEqual(requete.get_method(), "DELETE")
        self.assertEqual(requete.full_url,
                         "http://eureka:8761/eureka/apps/MARKET-SERVICE/localhost:market-service:8005")

    @mock.patch("urllib.request.urlopen")
    def test_worker_gunicorn_ne_se_desenregistre_pas(self, urlopen):
        # Un worker forké hérite du handler atexit du maître, mais n'a pas le même pid
        with self.assertLogs("marche.eureka", level="INFO"):
            self.demarrer()
        arreter = self.atexit_register.call_args.args[0]
        with mock.patch.object(eureka.os, "getpid", return_value=-1):
            arreter()
        urlopen.assert_not_called()

    @mock.patch("urllib.request.urlopen", side_effect=OSError("refus"))
    def test_desenregistrement_eureka_injoignable(self, urlopen):
        with self.assertLogs("marche.eureka", level="WARNING") as logs:
            eureka.desenregistrer()
        self.assertIn("Désenregistrement Eureka impossible", logs.output[0])
