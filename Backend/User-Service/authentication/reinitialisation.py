"""
« Mot de passe oublié » par CODE envoyé par e-mail.

1. demander_code(identifiant) — POST /api/auth/forgot-password/
   Compte cherché dans Keycloak (e-mail, sinon nom d'utilisateur). Code à 6 chiffres (module
   secrets) valable PASSWORD_RESET_CODE_MINUTES ; seul son haché HMAC-SHA256 est stocké ; un seul
   code actif par compte (une nouvelle demande remplace l'ancien). E-mail en français envoyé par
   Django (SMTP : Gmail ou Mailpit selon EMAIL_HOST). Au plus PASSWORD_RESET_MAX_REQUESTS demandes
   par e-mail sur PASSWORD_RESET_WINDOW_MINUTES. La réponse ne révèle jamais si le compte existe.

2. reinitialiser(identifiant, code, nouveau_mot_de_passe) — POST /api/auth/reset-password/
   Code comparé en temps constant ; expiré -> refusé ; au plus PASSWORD_RESET_MAX_ATTEMPTS essais
   faux, ensuite le code est annulé. Mot de passe changé dans Keycloak (temporary=false), puis le
   code est supprimé.
"""
import hashlib
import hmac
import logging
import re
import secrets
import threading
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from .keycloak_client import KeycloakService
from .models import CodeReinitialisation, DemandeReinitialisation

logger = logging.getLogger(__name__)

MESSAGE = "Si un compte existe, un code a été envoyé."
SUJET = "Votre code de réinitialisation LaunchPad AI"
DUREE_CONSERVATION = timedelta(days=1)  # demandes plus anciennes : supprimées au passage


class ErreurReinitialisation(Exception):
    """Refus de la réinitialisation : code_erreur stable (pour le front) et message en français."""

    def __init__(self, code_erreur, message):
        super().__init__(message)
        self.code_erreur = code_erreur
        self.message = message


CODE_INVALIDE = "code_invalide"
CODE_EXPIRE = "code_expire"
TROP_D_ESSAIS = "trop_essais"
MOT_DE_PASSE_FAIBLE = "mot_de_passe_faible"


# --- Règles -----------------------------------------------------------------------

def faiblesses_mot_de_passe(mot_de_passe):
    """Critères non respectés (liste vide : mot de passe accepté)."""
    manques = []
    if len(mot_de_passe) < 8:
        manques.append("au moins 8 caractères")
    if not re.search(r"[A-Z]", mot_de_passe):
        manques.append("une majuscule")
    if not re.search(r"\d", mot_de_passe):
        manques.append("un chiffre")
    if not re.search(r"[^A-Za-z0-9]", mot_de_passe):
        manques.append("un caractère spécial")
    return manques


def generer_code():
    return f"{secrets.randbelow(10**6):06d}"


def hacher(keycloak_id, code):
    """HMAC-SHA256 (clé : SECRET_KEY) du code, lié au compte : le code n'est jamais stocké en clair."""
    return hmac.new(settings.SECRET_KEY.encode(), f"{keycloak_id}:{code}".encode(), hashlib.sha256).hexdigest()


# --- Recherche du compte et limite des demandes --------------------------------------

def trouver_compte(keycloak, identifiant):
    """Compte Keycloak de cet e-mail ou nom d'utilisateur, ou None."""
    if "@" in identifiant:
        compte = keycloak.find_user_by_email(identifiant)
        if compte is not None:
            return compte
    return keycloak.find_user(identifiant)


def _limite_atteinte(cle):
    """Enregistre la demande si la limite n'est pas atteinte ; True si elle l'est."""
    maintenant = timezone.now()
    debut = maintenant - timedelta(minutes=settings.PASSWORD_RESET_WINDOW_MINUTES)
    with transaction.atomic():
        DemandeReinitialisation.objects.filter(date__lt=maintenant - DUREE_CONSERVATION).delete()
        if DemandeReinitialisation.objects.filter(cle=cle, date__gte=debut).count() \
                >= settings.PASSWORD_RESET_MAX_REQUESTS:
            return True
        DemandeReinitialisation.objects.create(cle=cle)
    return False


# --- 1. Demande de code ----------------------------------------------------------------

def _prenom(compte):
    if compte.get("firstName"):
        return compte["firstName"]
    profil = get_user_model().objects.filter(keycloak_id=compte["id"]).first()
    return (profil.first_name if profil else "") or compte.get("username", "")


def _envoyer_email(destinataire, prenom, code):
    minutes = settings.PASSWORD_RESET_CODE_MINUTES
    texte = (
        f"Bonjour {prenom}, voici votre code : {code}. Il est valable {minutes} minutes. "
        "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
    )
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2a2e;line-height:1.5">'
        f"<p>Bonjour {escape(prenom)},</p>"
        "<p>voici votre code de réinitialisation LaunchPad AI :</p>"
        f'<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">{code}</p>'
        f"<p>Il est valable {minutes} minutes.</p>"
        '<p style="color:#5a6a6f">Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet e-mail.</p>'
        "</div>"
    )
    try:
        send_mail(SUJET, texte, settings.DEFAULT_FROM_EMAIL, [destinataire], html_message=html)
        logger.info("Code de réinitialisation envoyé par e-mail.")
    except Exception as exc:  # noqa: BLE001 (SMTP injoignable, identifiants refusés...)
        logger.error("Envoi du code de réinitialisation impossible : %s", exc)


def demander_code(identifiant, keycloak=None):
    """
    Traite une demande. Renvoie le motif (logs et tests, jamais exposé au client) : "envoye",
    "limite", "inconnu" ou "sans_email". Lève une exception si Keycloak est injoignable.
    """
    keycloak = keycloak or KeycloakService()
    identifiant = identifiant.strip()
    compte = trouver_compte(keycloak, identifiant)

    # Limite par e-mail : celui du compte s'il existe (e-mail ou username saisi), sinon la saisie
    cle = ((compte or {}).get("email") or identifiant).lower()
    if _limite_atteinte(cle):
        logger.warning("Mot de passe oublié : limite de %s demandes atteinte, aucun code envoyé.",
                       settings.PASSWORD_RESET_MAX_REQUESTS)
        return "limite"
    if compte is None:
        logger.info("Mot de passe oublié : aucun compte correspondant, aucun code envoyé.")
        return "inconnu"
    if not compte.get("email") or not compte.get("enabled", True):
        logger.info("Mot de passe oublié : compte %s sans e-mail ou désactivé.", compte["id"])
        return "sans_email"

    code = generer_code()
    # Un seul code actif : la nouvelle demande remplace l'ancien code (et remet les essais à zéro)
    CodeReinitialisation.objects.update_or_create(
        keycloak_id=compte["id"],
        defaults={
            "code_hache": hacher(compte["id"], code),
            "expire_le": timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_CODE_MINUTES),
            "essais": 0,
        },
    )
    arguments = (compte["email"], _prenom(compte), code)
    if settings.PASSWORD_RESET_ASYNC:
        threading.Thread(target=_envoyer_email, args=arguments, daemon=True).start()
    else:
        _envoyer_email(*arguments)
    return "envoye"


# --- 2. Réinitialisation avec le code ---------------------------------------------------

def reinitialiser(identifiant, code, nouveau_mot_de_passe, keycloak=None):
    """Change le mot de passe si le code est bon ; lève ErreurReinitialisation sinon."""
    manques = faiblesses_mot_de_passe(nouveau_mot_de_passe)
    if manques:
        raise ErreurReinitialisation(
            MOT_DE_PASSE_FAIBLE, "Mot de passe trop faible : il doit contenir " + ", ".join(manques) + ".")

    keycloak = keycloak or KeycloakService()
    compte = trouver_compte(keycloak, identifiant.strip())
    invalide = ErreurReinitialisation(CODE_INVALIDE, "Code invalide.")
    if compte is None:
        raise invalide  # même réponse qu'un mauvais code : ne révèle pas l'existence du compte

    trop_d_essais = ErreurReinitialisation(
        TROP_D_ESSAIS, "Trop d'essais : ce code a été annulé. Demandez un nouveau code.")
    # L'erreur est levée APRÈS la transaction : l'essai compté (ou le code expiré supprimé)
    # doit être enregistré, pas annulé avec elle.
    erreur = None
    with transaction.atomic():
        actif = CodeReinitialisation.objects.select_for_update().filter(keycloak_id=compte["id"]).first()
        if actif is None:
            erreur = invalide
        elif actif.essais >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
            erreur = trop_d_essais
        elif actif.expire_le <= timezone.now():
            actif.delete()
            erreur = ErreurReinitialisation(CODE_EXPIRE, "Code expiré. Demandez un nouveau code.")
        elif not hmac.compare_digest(actif.code_hache, hacher(compte["id"], code.strip())):
            actif.essais += 1
            actif.save(update_fields=["essais"])
            restants = settings.PASSWORD_RESET_MAX_ATTEMPTS - actif.essais
            erreur = trop_d_essais if restants <= 0 else ErreurReinitialisation(
                CODE_INVALIDE, f"Code invalide. Il vous reste {restants} essai{'s' if restants > 1 else ''}.")
        else:
            # Code bon : changement dans Keycloak. S'il échoue, l'exception annule la transaction
            # et le code reste utilisable.
            keycloak.set_password(compte["id"], nouveau_mot_de_passe)
            actif.delete()
    if erreur is not None:
        raise erreur
    logger.info("Mot de passe réinitialisé par code (compte Keycloak %s).", compte["id"])
