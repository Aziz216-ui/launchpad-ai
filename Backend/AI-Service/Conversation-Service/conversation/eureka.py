"""
Enregistrement / desenregistrement Eureka pour le Conversation-Service.
Usage : appele depuis ConversationConfig.ready() dans apps.py.
"""
from __future__ import annotations

import logging
import os
import socket
import atexit

logger = logging.getLogger(__name__)

def _get_local_ip() -> str:
    host_ip = os.getenv("HOST_IP", "").strip()
    if host_ip:
        return host_ip
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"

def register():
    if os.environ.get("RUN_MAIN") == "true":
        logger.debug("Eureka: reloader detecte (RUN_MAIN=true) — enregistrement ignore.")
        return

    try:
        import py_eureka_client.eureka_client as eureka_client
    except ImportError:
        logger.warning("py_eureka_client non installe — enregistrement Eureka ignore.")
        return

    eureka_server = os.getenv("EUREKA_SERVER", "http://localhost:8761/eureka/")
    app_name = os.getenv("APP_NAME", "conversation-service").upper()
    app_port = int(os.getenv("APP_PORT", "8008"))
    host_ip = _get_local_ip()
    health_url = f"http://{host_ip}:{app_port}/api/ai/health/"

    try:
        eureka_client.init(
            eureka_server=eureka_server,
            app_name=app_name,
            instance_port=app_port,
            instance_host=host_ip,
            health_check_url=health_url,
            renewal_interval_in_secs=30,
            duration_in_secs=90,
        )
        logger.info(
            "Eureka: service '%s' enregistre sur %s (IP=%s, port=%s, health=%s)",
            app_name, eureka_server, host_ip, app_port, health_url,
        )
        atexit.register(_deregister)
    except Exception as exc:
        logger.warning("Eureka: enregistrement echoue (%s). Le service continue sans Eureka.", exc)

def _deregister():
    try:
        import py_eureka_client.eureka_client as eureka_client
        eureka_client.stop()
        logger.info("Eureka: service desenregistre.")
    except Exception as exc:
        logger.warning("Eureka: desenregistrement echoue : %s", exc)

