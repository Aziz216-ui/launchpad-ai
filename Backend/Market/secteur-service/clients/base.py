"""
Client REST générique vers un autre microservice du marché (équivalent d'OpenFeign).

- Adresse résolue dans Eureka (py-eureka-client) à partir du nom du service ;
  repli sur l'URL directe <NOM>_SERVICE_URL (settings.SERVICES_URLS) si Eureka
  est désactivé, injoignable ou ne connaît aucune instance UP.
- Timeout court (3 s) et une nouvelle tentative en cas d'erreur réseau ou de 5xx.
- 404 -> RessourceIntrouvable (l'appelant la traduit en 400) ;
  service injoignable -> ServiceIndisponible (503 JSON, voir <app>/exceptions.py).

Chaque client concret déclare le nom Eureka du service appelé et le chemin de sa
ressource, et hérite de get(id), exists(id) et list(ids=[...]).
"""

import asyncio
import logging
import random
import time

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

DUREE_CACHE = 15  # secondes pendant lesquelles une adresse lue dans Eureka est réutilisée
HOTES_LOCAUX = ("localhost", "127.0.0.1")

_cache = {}  # nom du service -> (url, date d'expiration)


class ServiceIndisponible(Exception):
    """Le service appelé ne répond pas (arrêté, injoignable, erreur 5xx)."""

    def __init__(self, service, detail=""):
        super().__init__(f"{service} indisponible : {detail}")
        self.service = service


class RessourceIntrouvable(Exception):
    """Le service appelé a répondu 404."""


def vider_cache():
    _cache.clear()


def adresse_eureka(service):
    """URL http://hote:port d'une instance UP du service dans Eureka, ou None."""
    from py_eureka_client import eureka_basic

    async def lire_application():
        return await asyncio.wait_for(
            eureka_basic.get_application(settings.EUREKA_SERVER_URL, service),
            settings.SERVICE_CLIENT_TIMEOUT,
        )

    try:
        application = asyncio.run(lire_application())
    except Exception as exc:  # Eureka injoignable, service inconnu (404)...
        logger.warning("Résolution Eureka de %s impossible : %s", service, exc or type(exc).__name__)
        return None
    instances = application.up_instances
    if not instances:
        return None
    instance = random.choice(instances)  # répartition simple entre les instances
    hote = instance.hostName or instance.ipAddr
    if hote in HOTES_LOCAUX and settings.EUREKA_LOCALHOST_ALIAS:
        hote = settings.EUREKA_LOCALHOST_ALIAS
    return f"http://{hote}:{instance.port.port}"


class ServiceClient:
    service = ""    # nom Eureka, ex. "SECTEUR-SERVICE"
    ressource = ""  # chemin de la ressource, ex. "/api/market/secteurs/"

    def adresse(self, rafraichir=False):
        """Adresse du service : Eureka (avec cache court) puis URL directe."""
        if settings.EUREKA_ENABLED:
            en_cache = _cache.get(self.service)
            if en_cache and not rafraichir and en_cache[1] > time.monotonic():
                return en_cache[0]
            url = adresse_eureka(self.service)
            if url:
                _cache[self.service] = (url, time.monotonic() + DUREE_CACHE)
                return url
            _cache.pop(self.service, None)
        return settings.SERVICES_URLS[self.service].rstrip("/")

    def requete(self, chemin, params=None, methode="GET"):
        """Appel HTTP avec timeout et une nouvelle tentative ; renvoie le JSON (ou None)."""
        erreur = ""
        for tentative in range(1 + settings.SERVICE_CLIENT_RETRIES):
            url = self.adresse(rafraichir=tentative > 0) + chemin
            try:
                reponse = requests.request(
                    methode, url, params=params, timeout=settings.SERVICE_CLIENT_TIMEOUT,
                    headers={"Accept": "application/json"},
                )
            except requests.RequestException as exc:
                erreur = f"{type(exc).__name__} sur {url}"
                logger.warning("Appel %s %s (tentative %d) : %s", methode, url, tentative + 1, exc)
                continue

            if reponse.status_code == 404:
                raise RessourceIntrouvable(chemin)
            if reponse.status_code == 503:
                # Le service appelé dépend lui-même d'un service arrêté : on remonte son nom
                try:
                    cause = reponse.json().get("service")
                except (ValueError, AttributeError):
                    cause = None
                if cause and cause != self.service:
                    raise ServiceIndisponible(cause, f"via {self.service}")
            if reponse.status_code >= 500:
                erreur = f"HTTP {reponse.status_code} sur {url}"
                logger.warning("Appel %s %s (tentative %d) : HTTP %d", methode, url, tentative + 1,
                               reponse.status_code)
                continue
            if reponse.status_code >= 400:
                logger.error("Réponse inattendue de %s : HTTP %d %s", url, reponse.status_code,
                             reponse.text[:200])
                raise ServiceIndisponible(self.service, f"HTTP {reponse.status_code}")
            return reponse.json() if reponse.content else None
        raise ServiceIndisponible(self.service, erreur)

    # --- Méthodes communes (ressource principale du service) -----------------

    def get(self, id):
        return self.requete(f"{self.ressource}{int(id)}/")

    def exists(self, id):
        try:
            self.get(id)
        except RessourceIntrouvable:
            return False
        return True

    def list(self, ids=None, **filtres):
        """Liste filtrée ; ids=[1, 2, 3] -> un seul appel ?ids=1,2,3 (pas N appels)."""
        params = {cle: valeur for cle, valeur in filtres.items() if valeur is not None}
        if ids is not None:
            ids = sorted({int(i) for i in ids})
            if not ids:
                return []
            params["ids"] = ",".join(str(i) for i in ids)
        return self.requete(self.ressource, params=params)
