"""Client de SECTEUR-SERVICE (vérification et nom des secteurs)."""

import logging

from .base import ServiceClient, ServiceIndisponible

logger = logging.getLogger(__name__)


class SecteurClient(ServiceClient):
    service = "SECTEUR-SERVICE"
    ressource = "/api/market/secteurs/"

    def noms(self, ids):
        """
        {id: nom} des secteurs demandés, en un appel ?ids=...

        Utilisé pour l'affichage (secteur_nom) : si SECTEUR-SERVICE est indisponible,
        la liste des concurrents reste consultable avec secteur_nom = null.
        """
        ids = {i for i in ids if i is not None}  # secteur_id null : secteur supprimé
        if not ids:
            return {}
        try:
            return {s["id"]: s["nom"] for s in self.list(ids=ids)}
        except ServiceIndisponible as exc:
            logger.warning("Noms des secteurs indisponibles : %s", exc)
            return {}
