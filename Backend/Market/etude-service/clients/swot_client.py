"""Client de SWOT-SERVICE (éléments SWOT d'une étude)."""

from market_commun.clients import ServiceClient


class SwotClient(ServiceClient):
    service = "SWOT-SERVICE"
    ressource = "/api/market/swot/"

    def de_l_etude(self, etude_id):
        """Éléments SWOT enregistrés pour l'étude (?etude=<id>)."""
        return self.list(etude=etude_id)

    def apercu(self, etude_id):
        """SWOT calculée à la volée, sans enregistrement : [{type, description}, ...]."""
        return self.requete(f"/api/market/etudes/{int(etude_id)}/generer-swot/")["elements"]
