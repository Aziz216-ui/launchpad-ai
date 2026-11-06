"""Client de SECTEUR-SERVICE (vérification et nom des secteurs : get, exists, noms)."""

from market_commun.clients import ServiceClient


class SecteurClient(ServiceClient):
    service = "SECTEUR-SERVICE"
    ressource = "/api/market/secteurs/"
