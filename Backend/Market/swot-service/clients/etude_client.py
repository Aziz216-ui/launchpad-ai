"""Client d'ETUDE-SERVICE (données d'une étude pour les règles de la SWOT)."""

from .base import ServiceClient


class EtudeClient(ServiceClient):
    service = "ETUDE-SERVICE"
    ressource = "/api/market/etudes/"

    def exists(self, id):
        # Liste filtrée ?ids=<id> : plus léger que le détail, qui agrège d'autres services
        return bool(self.list(ids=[id]))

    def comparaison_prix(self, id):
        """GET /etudes/<id>/comparaison-prix/ (prix des concurrents lus par ETUDE-SERVICE)."""
        return self.requete(f"{self.ressource}{int(id)}/comparaison-prix/")

    def opportunites_menaces(self, id):
        """GET /etudes/<id>/opportunites-menaces/ (tendances, concurrence, croissance, prix)."""
        return self.requete(f"{self.ressource}{int(id)}/opportunites-menaces/")
