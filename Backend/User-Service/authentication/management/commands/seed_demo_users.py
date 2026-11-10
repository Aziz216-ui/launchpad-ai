"""Crée les utilisateurs de démonstration (Keycloak + base locale), de façon idempotente.

  Ahmed -> rôle ADMIN        (seul rôle autorisé à faire des DELETE via la gateway)
  Adem  -> rôle ENTREPRENEUR (utilisateur simple : DELETE refusé avec 403)
  Sarra -> rôle LAWYER     (revue des documents juridiques : Juridique > Documents)
  Nadia, Walid -> rôle ACCOUNTANT (annuaire « Demander un comptable » ; leur espace comptable est
                  créé par workspace-service via sync_accountant_workspaces, lancée juste après)

L'inscription publique ne permet PAS de choisir ADMIN : ce compte n'existe que par cette commande.
Mots de passe : variables DEMO_ADMIN_PASSWORD / DEMO_USER_PASSWORD / DEMO_ACCOUNTANT_PASSWORD /
DEMO_LAWYER_PASSWORD
(valeurs de démo par défaut).
"""
import os

from django.core.management.base import BaseCommand
from django.db import transaction

from authentication.keycloak_client import KeycloakService
from authentication.models import User


class Command(BaseCommand):
    help = "Crée les comptes de démo Ahmed (ADMIN), Adem (ENTREPRENEUR), Nadia et Walid (ACCOUNTANT), Sarra (LAWYER)."

    def handle(self, *args, **options):
        comptes = [
            ("ahmed", "ahmed@launchpad.local", "Ahmed", User.Role.ADMIN,
             os.getenv("DEMO_ADMIN_PASSWORD", "Ahmed@2026!")),
            ("adem", "adem@launchpad.local", "Adem", User.Role.ENTREPRENEUR,
             os.getenv("DEMO_USER_PASSWORD", "Adem@2026!")),
            ("nadia", "nadia@launchpad.local", "Nadia", User.Role.ACCOUNTANT,
             os.getenv("DEMO_ACCOUNTANT_PASSWORD", "Comptable@2026!")),
            ("walid", "walid@launchpad.local", "Walid", User.Role.ACCOUNTANT,
             os.getenv("DEMO_ACCOUNTANT_PASSWORD", "Comptable@2026!")),
            ("sarra", "sarra@launchpad.local", "Sarra", User.Role.LAWYER,
             os.getenv("DEMO_LAWYER_PASSWORD", "Avocat@2026!")),
        ]
        keycloak = KeycloakService()
        for username, email, prenom, role, password in comptes:
            if User.objects.filter(username=username).exists():
                self.stdout.write(f"'{username}' existe déjà : ignoré.")
                continue
            keycloak_id = keycloak.register_user(
                username=username, email=email, password=password,
                first_name=prenom, last_name="Demo", role=role)
            with transaction.atomic():
                User.objects.create(
                    keycloak_id=keycloak_id, username=username, email=email,
                    first_name=prenom, last_name="Demo", role=role)
            self.stdout.write(self.style.SUCCESS(f"'{username}' créé avec le rôle {role}."))
