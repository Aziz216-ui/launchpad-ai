"""Crée ou répare les utilisateurs de démonstration (Keycloak + base locale), de façon idempotente.

  Ahmed -> rôle ADMIN        (seul rôle autorisé à faire des DELETE via la gateway)
  Adem  -> rôle ENTREPRENEUR (utilisateur simple : DELETE refusé avec 403)
  Sarra -> rôle LAWYER     (revue des documents juridiques : Juridique > Documents)
  Nadia, Walid -> rôle ACCOUNTANT (annuaire « Demander un comptable » ; leur espace comptable est
                  créé par workspace-service via sync_accountant_workspaces, lancée juste après)

Idempotente des deux côtés (voir authentication/synchronisation.py) : un compte absent de Keycloak
(ex. Keycloak réinitialisé) y est recréé et son keycloak_id mis à jour en base ; un profil absent
de la base est créé ; un rôle différent est corrigé. Rien n'est jamais dupliqué.

L'inscription publique ne permet PAS de choisir ADMIN : ce compte n'existe que par cette commande.
Mots de passe : variables DEMO_ADMIN_PASSWORD / DEMO_USER_PASSWORD / DEMO_ACCOUNTANT_PASSWORD /
DEMO_LAWYER_PASSWORD (valeurs de démo par défaut).

  python manage.py seed_demo_users [--dry-run] [--attendre 60]
"""
import time

from django.core.management.base import BaseCommand, CommandError

from authentication.keycloak_client import KeycloakService
from authentication.synchronisation import Rapport, assurer_compte_demo, comptes_demo


class Command(BaseCommand):
    help = "Crée ou répare les comptes de démo Ahmed (ADMIN), Adem (ENTREPRENEUR), Nadia et Walid (ACCOUNTANT), Sarra (LAWYER)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Affiche les corrections sans rien modifier.")
        parser.add_argument("--attendre", type=int, default=0, metavar="SECONDES",
                            help="Attend jusqu'à SECONDES que l'API d'administration Keycloak réponde.")

    def handle(self, *args, **options):
        keycloak = KeycloakService()
        self._attendre_keycloak(keycloak, options["attendre"])
        rapport = Rapport(dry_run=options["dry_run"])
        for compte in comptes_demo():
            assurer_compte_demo(compte, keycloak, rapport)
            actions = rapport.actions_de(compte.username)
            if actions:
                for action in actions:
                    self.stdout.write(self.style.SUCCESS(f"'{compte.username}' : {action}"))
            else:
                self.stdout.write(f"'{compte.username}' : déjà synchronisé ({compte.role}).")

    def _attendre_keycloak(self, keycloak, secondes):
        """Au démarrage du conteneur, Keycloak peut encore être en train de démarrer."""
        limite = time.monotonic() + secondes
        while True:
            try:
                keycloak.find_user("__verification__")
                return
            except Exception as exc:  # noqa: BLE001 (connexion refusée, 503, jeton admin...)
                if time.monotonic() >= limite:
                    raise CommandError(f"Keycloak injoignable : {exc}") from exc
                self.stdout.write("Keycloak pas encore prêt, nouvelle tentative dans 5 s...")
                time.sleep(5)
