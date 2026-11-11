"""Compare la base du User-Service et Keycloak, corrige les écarts et affiche un rapport.

  python manage.py sync_keycloak            # applique les corrections
  python manage.py sync_keycloak --dry-run  # affiche seulement ce qui serait fait

Règles : voir authentication/synchronisation.py (synchroniser). Les comptes recréés dans
Keycloak reçoivent un mot de passe temporaire (affiché une seule fois dans ce rapport) et
l'action requise UPDATE_PASSWORD, sauf les comptes de démo (mot de passe de démo).
"""
from django.core.management.base import BaseCommand

from authentication.keycloak_client import KeycloakService
from authentication.synchronisation import synchroniser


class Command(BaseCommand):
    help = "Synchronise les profils de la base avec les comptes Keycloak (rapport, --dry-run possible)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Affiche les corrections sans rien modifier.")

    def handle(self, *args, **options):
        rapport, temporaires = synchroniser(KeycloakService(), dry_run=options["dry_run"])

        titre = "Synchronisation Keycloak <-> base" + (" (dry-run : aucune modification)" if rapport.dry_run else "")
        self.stdout.write(self.style.MIGRATE_HEADING(titre))
        if not rapport.lignes:
            self.stdout.write(self.style.SUCCESS("Aucun écart : la base et Keycloak sont synchronisés."))
            return
        largeur = max(len(nom) for nom, _ in rapport.lignes)
        for nom, action in rapport.lignes:
            self.stdout.write(f"  {nom:<{largeur}}  {action}")
        self.stdout.write(self.style.SUCCESS(
            f"{len(rapport.lignes)} correction(s) sur {len({n for n, _ in rapport.lignes})} compte(s)."))

        if temporaires:
            self.stdout.write(self.style.WARNING(
                "Mots de passe temporaires (à transmettre aux utilisateurs, à changer à la première connexion) :"))
            for nom, mot_de_passe in temporaires.items():
                self.stdout.write(f"  {nom:<{largeur}}  {mot_de_passe}")
