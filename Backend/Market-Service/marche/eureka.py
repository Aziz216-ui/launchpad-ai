"""
Enregistrement du Market-Service dans le serveur Eureka (py-eureka-client).

Appelé une seule fois depuis MarcheConfig.ready(), et seulement quand Django sert
des requêtes (runserver ou gunicorn) : jamais pendant migrate, test, shell...
Si Eureka est injoignable, un avertissement est loggé et le service démarre quand
même ; py-eureka-client retente l'enregistrement à chaque heartbeat (30 s).
"""

import atexit
import logging
import os
import sys
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

HEALTH_CHECK_PATH = "/api/market/health/"
STATUS_PAGE_PATH = "/api/market/docs/"
HOME_PAGE_PATH = "/api/market/"

_demarre = False
_injoignable = False
_arrete = False


def est_un_serveur(argv=None, environ=None):
    """
    Vrai si le processus courant sert des requêtes HTTP.

    - gunicorn : lancé avec --preload, ready() ne s'exécute que dans le processus maître.
    - runserver : avec l'autoreload, Django lance deux processus ; seul le processus
      enfant (RUN_MAIN=true) sert les requêtes.
    """
    argv = sys.argv if argv is None else argv
    environ = os.environ if environ is None else environ
    if not argv:
        return False
    if "gunicorn" in os.path.basename(argv[0]):
        return True
    if len(argv) > 1 and argv[1] == "runserver":
        return "--noreload" in argv or environ.get("RUN_MAIN") == "true"
    return False


def _url_instance(chemin):
    return f"http://{settings.EUREKA_INSTANCE_HOST}:{settings.EUREKA_INSTANCE_PORT}{chemin}"


def identifiant_instance():
    """Identifiant de l'instance dans Eureka, au format Spring : host:app:port."""
    return (f"{settings.EUREKA_INSTANCE_HOST}:{settings.EUREKA_APP_NAME.lower()}:"
            f"{settings.EUREKA_INSTANCE_PORT}")


def desenregistrer():
    """
    Retire l'instance d'Eureka (DELETE /apps/<app>/<instance>).

    Appelé par atexit : à ce moment, Python a déjà fermé les pools de threads dont
    py-eureka-client (httpx) a besoin, d'où une requête urllib synchrone.
    """
    global _arrete
    _arrete = True
    url = (f"{settings.EUREKA_SERVER_URL.rstrip('/')}/apps/{settings.EUREKA_APP_NAME}/"
           f"{identifiant_instance()}")
    try:
        urllib.request.urlopen(urllib.request.Request(url, method="DELETE"), timeout=3)
    except Exception as exc:
        logger.warning("Désenregistrement Eureka impossible : %s", exc)
    else:
        logger.info("Désenregistré d'Eureka (%s).", settings.EUREKA_APP_NAME)


def _signaler_erreur(type_erreur, exception):
    """Callback de py-eureka-client : un seul avertissement tant qu'Eureka reste injoignable."""
    global _injoignable
    if _arrete:  # heartbeat pendant l'arrêt du processus : sans intérêt
        return
    if _injoignable:
        logger.debug("Eureka toujours injoignable (%s) : %s", type_erreur, exception)
        return
    _injoignable = True
    logger.warning(
        "Eureka injoignable (%s) : %s: %s. Le Market-Service fonctionne sans enregistrement, "
        "nouvel essai à chaque heartbeat.", settings.EUREKA_SERVER_URL, type(exception).__name__, exception,
    )


def demarrer():
    """Enregistre le service dans Eureka si EUREKA_ENABLED=true (une seule fois par processus)."""
    global _demarre
    if _demarre or not settings.EUREKA_ENABLED or not est_un_serveur():
        return
    _demarre = True

    from py_eureka_client import eureka_client
    from py_eureka_client import logger as eureka_logger

    # Les erreurs passent par _signaler_erreur : on coupe les traces de la librairie
    eureka_logger.set_level("ERROR")
    try:
        eureka_client.init(
            eureka_server=settings.EUREKA_SERVER_URL,
            app_name=settings.EUREKA_APP_NAME,
            instance_id=identifiant_instance(),
            instance_host=settings.EUREKA_INSTANCE_HOST,
            instance_port=settings.EUREKA_INSTANCE_PORT,
            health_check_url=_url_instance(HEALTH_CHECK_PATH),
            status_page_url=_url_instance(STATUS_PAGE_PATH),
            home_page_url=_url_instance(HOME_PAGE_PATH),
            should_discover=False,  # le service ne consomme pas le registre
            on_error=_signaler_erreur,
        )
    except Exception as exc:  # le service doit démarrer même si l'enregistrement échoue
        logger.warning("Enregistrement Eureka impossible : %s. Le Market-Service démarre quand même.", exc)
        return

    if not _injoignable:
        logger.info("Enregistré dans Eureka (%s) sous %s.", settings.EUREKA_SERVER_URL, settings.EUREKA_APP_NAME)

    # Désenregistrement à l'arrêt. Les workers gunicorn héritent des handlers atexit
    # du maître : seul le processus qui s'est enregistré se désenregistre.
    pid = os.getpid()

    def arreter():
        if os.getpid() == pid:
            desenregistrer()

    atexit.register(arreter)
