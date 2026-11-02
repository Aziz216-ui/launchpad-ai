"""
Faux SECTEUR-SERVICE, CONCURRENT-SERVICE et SWOT-SERVICE pour les tests.

Les méthodes des clients REST (clients/) sont remplacées par des fonctions qui lisent
des données en mémoire, au format JSON renvoyé par les vrais services.
"""

from unittest import mock

from clients import RessourceIntrouvable


class FauxServices:
    def __init__(self):
        self.secteurs = {}     # id -> {"id", "nom"}
        self.concurrents = {}  # id -> concurrent (format CONCURRENT-SERVICE)
        self.tendances = {}    # id -> tendance (format SECTEUR-SERVICE)
        self.swot = []         # éléments enregistrés dans SWOT-SERVICE
        self.apercu = []       # SWOT calculée renvoyée par GET /etudes/<id>/generer-swot/
        self.swot_supprimee = []
        self._id = 0

    def _nouvel_id(self):
        self._id += 1
        return self._id

    # --- Création des données ---------------------------------------------------

    def secteur(self, nom):
        s = {"id": self._nouvel_id(), "nom": nom, "description": "", "date_creation": "2026-01-01T00:00:00Z"}
        self.secteurs[s["id"]] = s
        return s["id"]

    def concurrent(self, nom, secteur_id, prix="0", part="0", pays=""):
        c = {"id": self._nouvel_id(), "nom": nom, "secteur": secteur_id, "secteur_id": secteur_id,
             "secteur_nom": self.secteurs[secteur_id]["nom"], "site_web": "", "description": "",
             "forces": "", "faiblesses": "", "prix_moyen": float(prix), "part_de_marche": float(part),
             "pays": pays, "date_creation": "2026-01-01T00:00:00Z"}
        self.concurrents[c["id"]] = c
        return c["id"]

    def tendance(self, titre, secteur_id, impact="neutre", description=""):
        t = {"id": self._nouvel_id(), "titre": titre, "secteur": secteur_id, "secteur_id": secteur_id,
             "secteur_nom": self.secteurs[secteur_id]["nom"], "description": description, "impact": impact,
             "date_creation": f"2026-01-01T00:00:{self._id:02d}Z"}
        self.tendances[t["id"]] = t
        return t["id"]

    # --- Réponses des services (mêmes tris que les vrais services) ---------------

    def _secteur_get(self, client, id):
        if id not in self.secteurs:
            raise RessourceIntrouvable(id)
        return self.secteurs[id]

    def _secteur_list(self, client, ids=None, **filtres):
        resultat = [s for s in self.secteurs.values() if ids is None or s["id"] in set(ids)]
        return sorted(resultat, key=lambda s: s["nom"])

    def _tendances(self, client, ids=None, secteur=None):
        resultat = [t for t in self.tendances.values()
                    if (ids is None or t["id"] in set(ids)) and (secteur is None or t["secteur_id"] == secteur)]
        return sorted(resultat, key=lambda t: t["date_creation"], reverse=True)

    def _concurrent_list(self, client, ids=None, secteur=None, **filtres):
        resultat = [c for c in self.concurrents.values()
                    if (ids is None or c["id"] in set(ids)) and (secteur is None or c["secteur_id"] == secteur)]
        return sorted(resultat, key=lambda c: (-c["part_de_marche"], c["nom"]))

    def _swot_de_l_etude(self, client, etude_id):
        return [e for e in self.swot if e["etude_id"] == etude_id]

    def _swot_apercu(self, client, etude_id):
        return self.apercu

    def _swot_supprimer(self, client, etude_id):
        self.swot_supprimee.append(etude_id)

    def demarrer(self, test):
        """Installe les mocks pour la durée du test ; renvoie {nom: mock}."""
        cibles = {
            "secteur_get": ("clients.secteur_client.SecteurClient.get", self._secteur_get),
            "secteur_exists": ("clients.secteur_client.SecteurClient.exists",
                               lambda client, id: id in self.secteurs),
            "secteur_list": ("clients.secteur_client.SecteurClient.list", self._secteur_list),
            "tendances": ("clients.secteur_client.SecteurClient.tendances", self._tendances),
            "concurrent_list": ("clients.concurrent_client.ConcurrentClient.list", self._concurrent_list),
            "swot_de_l_etude": ("clients.swot_client.SwotClient.de_l_etude", self._swot_de_l_etude),
            "swot_apercu": ("clients.swot_client.SwotClient.apercu", self._swot_apercu),
            "swot_supprimer": ("clients.swot_client.SwotClient.supprimer_pour_etude", self._swot_supprimer),
        }
        mocks = {}
        for nom, (cible, fonction) in cibles.items():
            patcher = mock.patch(cible, autospec=True, side_effect=fonction)
            mocks[nom] = patcher.start()
            test.addCleanup(patcher.stop)
        return mocks
