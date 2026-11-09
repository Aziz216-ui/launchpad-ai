"""Crée les utilisateurs de démonstration (Keycloak + base locale), de façon idempotente.

  Ahmed -> rôle ADMIN        (seul rôle autorisé à faire des DELETE via la gateway)
  Adem  -> rôle ENTREPRENEUR (utilisateur simple : DELETE refusé avec 403)

L'inscription publique ne permet PAS de choisir ADMIN : ce compte n'existe que par cette commande.
Mots de passe : variables DEMO_ADMIN_PASSWORD / DEMO_USER_PASSWORD (valeurs de démo par défaut).
"""
import os

from django.core.management.base import BaseCommand
from django.db import transaction

from authentication.keycloak_client import KeycloakService
from authentication.models import User


class Command(BaseCommand):
    help = "Crée les comptes de démo Ahmed (ADMIN) et Adem (ENTREPRENEUR)."

    def handle(self, *args, **options):
        comptes = [
            ("ahmed", "ahmed@launchpad.local", "Ahmed", User.Role.ADMIN,
             os.getenv("DEMO_ADMIN_PASSWORD", "Ahmed@2026!")),
            ("adem", "adem@launchpad.local", "Adem", User.Role.ENTREPRENEUR,
             os.getenv("DEMO_USER_PASSWORD", "Adem@2026!")),
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
