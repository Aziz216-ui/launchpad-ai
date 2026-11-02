"""Client de CONCURRENT-SERVICE (concurrents d'un secteur pour l'analyse)."""

from .base import ServiceClient


class ConcurrentClient(ServiceClient):
    service = "CONCURRENT-SERVICE"
    ressource = "/api/market/concurrents/"

    def du_secteur(self, secteur_id):
        """Concurrents d'un secteur (filtre ?secteur=<id> du concurrent-service)."""
        return self.list(secteur=secteur_id)
