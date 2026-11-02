"""Client de SECTEUR-SERVICE (secteurs et tendances : même service, deux ressources)."""

import logging

from .base import RessourceIntrouvable, ServiceClient, ServiceIndisponible

logger = logging.getLogger(__name__)


class _TendanceRessource(ServiceClient):
    service = "SECTEUR-SERVICE"
    ressource = "/api/market/tendances/"


class SecteurClient(ServiceClient):
    service = "SECTEUR-SERVICE"
    ressource = "/api/market/secteurs/"

    def nom(self, id):
        """Nom du secteur, ou None s'il a été supprimé (503 si le service est injoignable)."""
        try:
            return self.get(id)["nom"]
        except RessourceIntrouvable:
            return None

    def noms(self, ids):
        """
        {id: nom} des secteurs demandés, en un appel ?ids=...

        Utilisé pour l'affichage (secteur_nom) : si SECTEUR-SERVICE est indisponible,
        la liste des études reste consultable avec secteur_nom = null.
        """
        try:
            return {s["id"]: s["nom"] for s in self.list(ids=ids)}
        except ServiceIndisponible as exc:
            logger.warning("Noms des secteurs indisponibles : %s", exc)
            return {}

    def tendances(self, ids=None, **filtres):
        """GET /api/market/tendances/?ids=...&secteur=..."""
        return _TendanceRessource().list(ids=ids, **filtres)
