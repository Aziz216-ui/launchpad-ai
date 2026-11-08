"""Tests du client REST générique (market_commun/clients.py), sans réseau ni serveur Eureka réel."""

from unittest import mock

import requests
from django.test import SimpleTestCase, override_settings

from market_commun import clients as base
from market_commun.clients import RessourceIntrouvable, ServiceClient, ServiceIndisponible

URL_DIRECTE = "http://service-direct:9000"


class ClientTest(ServiceClient):
    service = "TEST-SERVICE"
    ressource = "/api/market/objets/"


def reponse(code, json=None):
    r = mock.Mock(status_code=code, content=b"x" if json is not None else b"", text=str(json))
    r.json.return_value = json
    return r


def instance(hote, port, statut="UP"):
    return mock.Mock(hostName=hote, ipAddr="10.0.0.1", port=mock.Mock(port=port), status=statut)


@override_settings(SERVICES_URLS={"TEST-SERVICE": URL_DIRECTE}, EUREKA_ENABLED=False, SERVICE_SCHEME="http",
                   SERVICE_CLIENT_TIMEOUT=3, SERVICE_CLIENT_RETRIES=1, EUREKA_LOCALHOST_ALIAS="")
class ServiceClientTests(SimpleTestCase):
    def setUp(self):
        base.vider_cache()
        patcher = mock.patch("market_commun.clients.requests.request")
        self.request = patcher.start()
        self.addCleanup(patcher.stop)

    def test_ressource_existante(self):
        self.request.return_value = reponse(200, {"id": 3, "nom": "X"})
        self.assertEqual(ClientTest().get(3), {"id": 3, "nom": "X"})
        self.assertTrue(ClientTest().exists(3))
        methode, url = self.request.call_args.args
        self.assertEqual((methode, url), ("GET", f"{URL_DIRECTE}/api/market/objets/3/"))
        self.assertEqual(self.request.call_args.kwargs["timeout"], 3)

    def test_ressource_absente(self):
        self.request.return_value = reponse(404, {"detail": "Non trouvé."})
        with self.assertRaises(RessourceIntrouvable):
            ClientTest().get(9999)
        self.assertFalse(ClientTest().exists(9999))

    def test_service_indisponible_apres_une_nouvelle_tentative(self):
        self.request.side_effect = requests.ConnectionError("refus")
        with self.assertLogs("market_commun.clients", "WARNING"), self.assertRaises(ServiceIndisponible) as erreur:
            ClientTest().get(1)
        self.assertEqual(erreur.exception.service, "TEST-SERVICE")
        self.assertEqual(self.request.call_count, 2)  # 1 essai + 1 nouvelle tentative

    def test_nouvelle_tentative_reussie(self):
        self.request.side_effect = [requests.Timeout("lent"), reponse(200, {"id": 1})]
        with self.assertLogs("market_commun.clients", "WARNING"):
            self.assertEqual(ClientTest().get(1), {"id": 1})

    def test_erreur_5xx_traitee_comme_indisponible(self):
        self.request.return_value = reponse(500, {})
        with self.assertLogs("market_commun.clients", "WARNING"), self.assertRaises(ServiceIndisponible):
            ClientTest().get(1)

    def test_503_d_un_service_en_aval_remonte_son_nom(self):
        self.request.return_value = reponse(503, {"service": "AUTRE-SERVICE", "message": "Service indisponible"})
        with self.assertRaises(ServiceIndisponible) as erreur:
            ClientTest().get(1)
        self.assertEqual(erreur.exception.service, "AUTRE-SERVICE")

    def test_list_avec_ids_en_un_seul_appel(self):
        self.request.return_value = reponse(200, [{"id": 1}, {"id": 2}])
        ClientTest().list(ids=[2, 1, 2], secteur=None, pays="Tunisie")
        self.assertEqual(self.request.call_args.kwargs["params"], {"ids": "1,2", "pays": "Tunisie"})

    def test_noms_en_un_appel_et_ids_null_ignores(self):
        self.request.return_value = reponse(200, [{"id": 1, "nom": "FinTech"}])
        self.assertEqual(ClientTest().noms({1, None}), {1: "FinTech"})
        self.assertEqual(self.request.call_args.kwargs["params"], {"ids": "1"})
        self.assertEqual(ClientTest().noms({None}), {})
        self.assertEqual(self.request.call_count, 1)

    def test_noms_service_indisponible_degrade(self):
        self.request.side_effect = requests.ConnectionError("refus")
        with self.assertLogs("market_commun.clients", "WARNING"):
            self.assertEqual(ClientTest().noms({1}), {})

    def test_reponse_4xx_inattendue(self):
        self.request.return_value = reponse(400, {"detail": "?"})
        with self.assertLogs("market_commun.clients", "ERROR"), self.assertRaises(ServiceIndisponible):
            ClientTest().get(1)

    def test_list_ids_vide_sans_appel(self):
        self.assertEqual(ClientTest().list(ids=[]), [])
        self.request.assert_not_called()

    @override_settings(EUREKA_ENABLED=True)
    @mock.patch("market_commun.clients.adresse_eureka", return_value="http://localhost:8010")
    def test_adresse_lue_dans_eureka_et_mise_en_cache(self, adresse_eureka):
        self.request.return_value = reponse(200, {"id": 1})
        ClientTest().get(1)
        ClientTest().get(1)
        self.assertEqual(self.request.call_args.args[1], "http://localhost:8010/api/market/objets/1/")
        adresse_eureka.assert_called_once_with("TEST-SERVICE")

    @override_settings(EUREKA_ENABLED=True)
    @mock.patch("market_commun.clients.adresse_eureka", return_value=None)
    def test_repli_sur_l_url_directe_si_eureka_ne_connait_pas_le_service(self, adresse_eureka):
        self.request.return_value = reponse(200, {"id": 1})
        ClientTest().get(1)
        self.assertEqual(self.request.call_args.args[1], f"{URL_DIRECTE}/api/market/objets/1/")


@override_settings(EUREKA_ENABLED=True, EUREKA_SERVER_URL="http://eureka:8761/eureka/",
                   SERVICE_CLIENT_TIMEOUT=3, EUREKA_LOCALHOST_ALIAS="", SERVICE_SCHEME="http")
class AdresseEurekaTests(SimpleTestCase):
    def application(self, *instances):
        async def get_application(serveur, nom):
            self.assertEqual((serveur, nom), ("http://eureka:8761/eureka/", "TEST-SERVICE"))
            return mock.Mock(up_instances=list(instances))
        return mock.patch("py_eureka_client.eureka_basic.get_application", get_application)

    def test_instance_up(self):
        with self.application(instance("localhost", 8010)):
            self.assertEqual(base.adresse_eureka("TEST-SERVICE"), "http://localhost:8010")

    @override_settings(EUREKA_LOCALHOST_ALIAS="host.docker.internal")
    def test_localhost_remplace_par_l_alias_docker(self):
        with self.application(instance("localhost", 8010)):
            self.assertEqual(base.adresse_eureka("TEST-SERVICE"), "http://host.docker.internal:8010")

    def test_aucune_instance(self):
        with self.application():
            self.assertIsNone(base.adresse_eureka("TEST-SERVICE"))

    def test_eureka_injoignable(self):
        async def erreur(serveur, nom):
            raise OSError("connexion refusée")
        with mock.patch("py_eureka_client.eureka_basic.get_application", erreur), \
                self.assertLogs("market_commun.clients", "WARNING"):
            self.assertIsNone(base.adresse_eureka("TEST-SERVICE"))
