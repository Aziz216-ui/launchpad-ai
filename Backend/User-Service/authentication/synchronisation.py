"""
Synchronisation entre Keycloak et la base du User-Service.

Principe : Keycloak est la source de vérité pour l'authentification (comptes, mots de passe,
rôles du realm) ; la base garde le profil (User), relié au compte Keycloak par keycloak_id.
Un compte est reconnu d'abord par son keycloak_id, sinon par son username (Keycloak le stocke
en minuscules) : après une réinitialisation de Keycloak, le profil existant est relié au
nouveau compte au lieu d'être dupliqué.

Utilisé par :
- la connexion et l'authentification par jeton (provisionner_profil) ;
- python manage.py seed_demo_users (assurer_compte_demo) ;
- python manage.py sync_keycloak [--dry-run] (synchroniser).
"""
import logging
import os
import secrets
from dataclasses import dataclass, field

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

logger = logging.getLogger(__name__)
User = get_user_model()

# Plusieurs rôles applicatifs sur un compte : le plus élevé l'emporte (même ordre que la gateway)
PRIORITE_ROLES = ["ADMIN", "LAWYER", "ACCOUNTANT", "FINANCIER", "ENTREPRENEUR"]


@dataclass(frozen=True)
class CompteDemo:
    username: str
    email: str
    first_name: str
    role: str
    password: str
    last_name: str = "Demo"


def comptes_demo():
    """Comptes de démo ; mots de passe lus dans l'environnement (vide ou absent : valeur de démo)."""
    admin = os.getenv("DEMO_ADMIN_PASSWORD") or "Ahmed@2026!"
    entrepreneur = os.getenv("DEMO_USER_PASSWORD") or "Adem@2026!"
    comptable = os.getenv("DEMO_ACCOUNTANT_PASSWORD") or "Comptable@2026!"
    avocat = os.getenv("DEMO_LAWYER_PASSWORD") or "Avocat@2026!"
    return [
        CompteDemo("ahmed", "ahmed@launchpad.local", "Ahmed", User.Role.ADMIN, admin),
        CompteDemo("adem", "adem@launchpad.local", "Adem", User.Role.ENTREPRENEUR, entrepreneur),
        CompteDemo("nadia", "nadia@launchpad.local", "Nadia", User.Role.ACCOUNTANT, comptable),
        CompteDemo("walid", "walid@launchpad.local", "Walid", User.Role.ACCOUNTANT, comptable),
        CompteDemo("sarra", "sarra@launchpad.local", "Sarra", User.Role.LAWYER, avocat),
    ]


def role_depuis_roles(noms):
    """Rôle applicatif d'une liste de rôles du realm, ou None s'il n'y en a aucun."""
    return next((r for r in PRIORITE_ROLES if r in noms), None)


def _profil_par_username(username):
    return User.objects.filter(username__iexact=username).first()


def _email_disponible(email, keycloak_id, sauf=None):
    """Email du compte, ou une adresse de remplacement s'il est vide ou déjà pris par un autre profil."""
    pris = User.objects.filter(email__iexact=email).exclude(pk=getattr(sauf, "pk", None)).exists()
    if email and not pris:
        return email
    if email:
        logger.warning("Email %s déjà utilisé par un autre profil : adresse de remplacement.", email)
    return f"{keycloak_id}@keycloak.invalid"


def _creer_profil(keycloak_id, username, email, role, first_name="", last_name=""):
    return User.objects.create(
        keycloak_id=keycloak_id, username=username, email=_email_disponible(email, keycloak_id),
        first_name=first_name, last_name=last_name, role=role,
    )


# --- Connexion : profil créé ou relié à partir du jeton ------------------------

def provisionner_profil(payload):
    """
    Profil local de l'utilisateur d'un jeton Keycloak valide (claims sub, preferred_username,
    email, given_name, family_name, realm_access.roles) :
    - trouvé par keycloak_id : rôle aligné sur celui du jeton (Keycloak fait foi) ;
    - sinon trouvé par username : keycloak_id mis à jour (Keycloak réinitialisé) ;
    - sinon créé.
    """
    try:
        return _provisionner(payload)
    except IntegrityError:
        # Deux premières requêtes simultanées : l'autre a créé le profil entre-temps
        return User.objects.get(keycloak_id=payload["sub"])


def _provisionner(payload):
    keycloak_id = payload["sub"]
    username = payload.get("preferred_username") or payload.get("username") or keycloak_id
    role_jeton = role_depuis_roles(payload.get("realm_access", {}).get("roles", []))

    with transaction.atomic():
        profil = User.objects.select_for_update().filter(keycloak_id=keycloak_id).first()
        if profil is None:
            profil = _profil_par_username(username)
            if profil is not None:
                logger.info("Profil '%s' relié au compte Keycloak %s (ancien id %s).",
                            profil.username, keycloak_id, profil.keycloak_id)
                profil.keycloak_id = keycloak_id
                profil.save(update_fields=["keycloak_id", "updated_at"])
        if profil is None:
            profil = _creer_profil(
                keycloak_id, username, payload.get("email", ""), role_jeton or User.Role.ENTREPRENEUR,
                payload.get("given_name", ""), payload.get("family_name", ""),
            )
            logger.info("Profil '%s' créé à la connexion (rôle %s).", profil.username, profil.role)
        elif role_jeton and profil.role != role_jeton:
            logger.info("Rôle de '%s' aligné sur Keycloak : %s -> %s.", profil.username, profil.role, role_jeton)
            profil.role = role_jeton
            profil.save(update_fields=["role", "updated_at"])
    return profil


# --- Rapport commun à seed_demo_users et sync_keycloak -------------------------

@dataclass
class Rapport:
    dry_run: bool = False
    lignes: list = field(default_factory=list)  # (username, action)

    def ajouter(self, username, action):
        self.lignes.append((username, ("[dry-run] " if self.dry_run else "") + action))

    def actions_de(self, username):
        return [action for nom, action in self.lignes if nom == username]


# --- Comptes de démo (seed_demo_users) ------------------------------------------

def assurer_compte_demo(compte, keycloak, rapport):
    """
    Compte de démo présent des deux côtés, sans doublon :
    - absent de Keycloak : créé avec son rôle et son mot de passe de démo ;
    - présent : rôle applicatif corrigé s'il diffère, et mot de passe de démo réappliqué (un test
      de « Mot de passe oublié » ne doit pas casser la connexion des comptes de démo) ;
    - profil absent : créé ; présent : keycloak_id et rôle corrigés.
    """
    kc = keycloak.find_user(compte.username)
    if kc is None:
        rapport.ajouter(compte.username, f"créé dans Keycloak (rôle {compte.role})")
        keycloak_id = None
        if not rapport.dry_run:
            keycloak_id = keycloak.create_account(
                compte.username, compte.email, compte.password, compte.role,
                compte.first_name, compte.last_name)
    else:
        keycloak_id = kc["id"]
        roles = keycloak.get_app_roles(keycloak_id)
        if roles != [compte.role]:
            rapport.ajouter(compte.username, f"rôle Keycloak corrigé : {roles or 'aucun'} -> {compte.role}")
            if not rapport.dry_run:
                keycloak.set_app_role(keycloak_id, compte.role)
        if not rapport.dry_run:
            keycloak.set_password(keycloak_id, compte.password)

    profil = _profil_par_username(compte.username)
    if profil is None:
        rapport.ajouter(compte.username, "profil créé en base")
        if not rapport.dry_run:
            _creer_profil(keycloak_id, compte.username, compte.email, compte.role,
                          compte.first_name, compte.last_name)
        return
    _corriger_profil(profil, keycloak_id, compte.role, rapport)


def _corriger_profil(profil, keycloak_id, role, rapport):
    """Aligne keycloak_id et rôle du profil (keycloak_id None en dry-run : compte pas encore créé)."""
    champs = []
    if keycloak_id and profil.keycloak_id != keycloak_id:
        rapport.ajouter(profil.username, f"keycloak_id corrigé : {profil.keycloak_id} -> {keycloak_id}")
        profil.keycloak_id = keycloak_id
        champs.append("keycloak_id")
    if profil.role != role:
        rapport.ajouter(profil.username, f"rôle en base corrigé : {profil.role} -> {role}")
        profil.role = role
        champs.append("role")
    if champs and not rapport.dry_run:
        profil.save(update_fields=[*champs, "updated_at"])


# --- Synchronisation complète (sync_keycloak) ----------------------------------

def mot_de_passe_temporaire():
    return secrets.token_urlsafe(12)


def synchroniser(keycloak, dry_run=False):
    """
    Compare la base et Keycloak et corrige les écarts :
    - profil sans compte Keycloak : compte recréé (mot de passe temporaire + UPDATE_PASSWORD,
      sauf comptes de démo : leur mot de passe de démo) ; keycloak_id mis à jour ;
    - compte relié par username mais keycloak_id différent : keycloak_id corrigé ;
    - rôles différents : Keycloak fait foi (rôle en base corrigé), sauf compte sans rôle
      applicatif dans Keycloak (le rôle de la base y est affecté) et comptes de démo (rôle de démo
      imposé des deux côtés) ;
    - compte Keycloak sans profil : profil créé.
    Renvoie (Rapport, {username: mot de passe temporaire}).
    """
    rapport = Rapport(dry_run=dry_run)
    temporaires = {}
    demo = {c.username: c for c in comptes_demo()}

    comptes = keycloak.list_users()
    par_id = {c["id"]: c for c in comptes}
    par_username = {c["username"].lower(): c for c in comptes}
    relies = set()

    for profil in User.objects.filter(is_active=True).order_by("id"):
        compte_demo = demo.get(profil.username.lower())
        kc = par_id.get(profil.keycloak_id) or par_username.get(profil.username.lower())

        if kc is None:
            role = compte_demo.role if compte_demo else profil.role
            if compte_demo:
                password, temporaire = compte_demo.password, False
                rapport.ajouter(profil.username, f"recréé dans Keycloak (rôle {role}, mot de passe de démo)")
            else:
                password, temporaire = mot_de_passe_temporaire(), True
                rapport.ajouter(profil.username,
                                f"recréé dans Keycloak (rôle {role}, mot de passe temporaire, UPDATE_PASSWORD)")
            keycloak_id = None
            if not dry_run:
                keycloak_id = keycloak.create_account(
                    profil.username, profil.email, password, role,
                    profil.first_name, profil.last_name, temporary=temporaire)
                if temporaire:
                    temporaires[profil.username] = password
            _corriger_profil(profil, keycloak_id, role, rapport)
            continue

        relies.add(kc["id"])
        roles = keycloak.get_app_roles(kc["id"])
        role_kc = role_depuis_roles(roles)
        if compte_demo:
            role = compte_demo.role
            if roles != [role]:
                rapport.ajouter(profil.username, f"rôle Keycloak corrigé : {roles or 'aucun'} -> {role}")
                if not dry_run:
                    keycloak.set_app_role(kc["id"], role)
        elif role_kc is None:
            role = profil.role
            rapport.ajouter(profil.username, f"rôle {role} affecté dans Keycloak (aucun rôle applicatif)")
            if not dry_run:
                keycloak.set_app_role(kc["id"], role)
        else:
            role = role_kc  # Keycloak fait foi
        _corriger_profil(profil, kc["id"], role, rapport)

    for kc in comptes:
        if kc["id"] in relies or _profil_par_username(kc["username"]) is not None:
            continue  # déjà relié (ou profil inactif : on n'y touche pas)
        role = role_depuis_roles(keycloak.get_app_roles(kc["id"])) or User.Role.ENTREPRENEUR
        rapport.ajouter(kc["username"], f"profil créé en base (rôle {role})")
        if not dry_run:
            _creer_profil(kc["id"], kc["username"], kc.get("email", ""), role,
                          kc.get("firstName", ""), kc.get("lastName", ""))

    return rapport, temporaires
