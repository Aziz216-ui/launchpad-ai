"""
Enregistrement / desenregistrement Eureka pour le Co-Fondateur IA.

Usage : appele depuis CofondateurConfig.ready() dans apps.py.
- Compatible runserver (filtre RUN_MAIN pour eviter la double registration
  causee par l'auto-reloader) ET gunicorn (pas de RUN_MAIN => toujours actif).
- Ne crashe jamais : si Eureka est injoignable, log un warning et continue.
"""
from __future__ import annotations

import logging
import os
import socket
import atexit

logger = logging.getLogger(__name__)


def _get_local_ip() -> str:
    """Retourne HOST_IP depuis l'env, ou l'IP locale detectee automatiquement."""
    host_ip = os.getenv("HOST_IP", "").strip()
    if host_ip:
        return host_ip
    # Detection automatique : ouvre un socket UDP (sans envoi) pour trouver l'IP sortante
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def register():
    """
    Enregistre le service dans Eureka via py_eureka_client.
    Appele une seule fois au demarrage (guard RUN_MAIN + guard double-appel).
    """
    # --- Guard 1 : evite la double registration avec le reloader de runserver ---
    # RUN_MAIN est defini par le reloader ; le vrai processus serveur ne l'a pas.
    # Sous gunicorn il n'existe pas non plus, donc l'enregistrement se fait toujours.
    if os.environ.get("RUN_MAIN") == "true":
        logger.debug("Eureka: reloader detecte (RUN_MAIN=true) — enregistrement ignore.")
        return

    try:
        import py_eureka_client.eureka_client as eureka_client  # noqa: WPS433
    except ImportError:
        logger.warning("py_eureka_client non installe — enregistrement Eureka ignore.")
        return

    eureka_server = os.getenv("EUREKA_SERVER", "http://localhost:8761/eureka/")
    app_name = os.getenv("APP_NAME", "ai-service").upper()   # Eureka enregistre en MAJUSCULES
    app_port = int(os.getenv("APP_PORT", "8085"))
    host_ip = _get_local_ip()
    health_url = f"http://{host_ip}:{app_port}/api/ai/health/"

    try:
        eureka_client.init(
            eureka_server=eureka_server,
            app_name=app_name,
            instance_port=app_port,
            instance_host=host_ip,
            health_check_url=health_url,
            # Reessaie automatiquement si Eureka est momentanement injoignable
            renewal_interval_in_secs=30,
            duration_in_secs=90,
        )
        logger.info(
            "Eureka: service '%s' enregistre sur %s (IP=%s, port=%s, health=%s)",
            app_name, eureka_server, host_ip, app_port, health_url,
        )
        # Desenregistrement propre a l'arret du processus
        atexit.register(_deregister)
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Eureka: enregistrement echoue (%s). Le service continue sans Eureka.", exc
        )


def _deregister():
    """Desenregistre proprement depuis Eureka a l'arret."""
    try:
        import py_eureka_client.eureka_client as eureka_client
        eureka_client.stop()
        logger.info("Eureka: service desenregistre.")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Eureka: desenregistrement echoue : %s", exc)
