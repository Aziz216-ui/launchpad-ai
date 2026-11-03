"""Client de SECTEUR-SERVICE (secteurs et tendances : même service, deux ressources)."""

from market_commun.clients import RessourceIntrouvable, ServiceClient


class _TendanceRessource(ServiceClient):
    service = "SECTEUR-SERVICE"
    ressource = "/api/market/tendances/"


class SecteurClient(ServiceClient):
    """Secteurs : get, exists, list et noms (hérités) ; nom d'un secteur ; tendances."""

    service = "SECTEUR-SERVICE"
    ressource = "/api/market/secteurs/"

    def nom(self, id):
        """Nom du secteur, ou None s'il a été supprimé (503 si le service est injoignable)."""
        if id is None:  # secteur_id remis à null par l'événement secteur.supprime
            return None
        try:
            return self.get(id)["nom"]
        except RessourceIntrouvable:
            return None

    def tendances(self, ids=None, **filtres):
        """GET /api/market/tendances/?ids=...&secteur=..."""
        return _TendanceRessource().list(ids=ids, **filtres)
