import atexit
import logging
import os
import sys
import threading

from django.apps import AppConfig

logger = logging.getLogger(__name__)

_eureka_lock = threading.Lock()
_eureka_registered = False


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "authentication"

    def ready(self):
        commands = sys.argv
        is_runserver = "runserver" in commands
        is_server = is_runserver or any(
            cmd in commands for cmd in ("gunicorn", "uvicorn", "waitress")
        )
        if not is_server:
            # migrate, test, shell, makemigrations, etc. must not register.
            return

        if is_runserver:
            # runserver's autoreloader starts a watcher process and a reloaded
            # child; only the child (RUN_MAIN=true) or a run with --noreload
            # should register, otherwise the watcher registers a duplicate too.
            # gunicorn/uvicorn/waitress have no such double-process reloader.
            is_reloader_child = os.environ.get("RUN_MAIN") == "true" or "--noreload" in commands
            if not is_reloader_child:
                return

        from django.conf import settings

        if not getattr(settings, "EUREKA_ENABLED", True):
            return

        global _eureka_registered
        with _eureka_lock:
            if _eureka_registered:
                return
            _eureka_registered = True

        threading.Thread(target=_register_eureka, daemon=True).start()


def _register_eureka():
    try:
        import asyncio

        import py_eureka_client.eureka_client as eureka_client
        from django.conf import settings

        eureka_server = getattr(settings, "EUREKA_SERVER_URL", "http://localhost:8761/eureka")
        service_port = getattr(settings, "SERVICE_PORT", 8001)
        instance_host = getattr(settings, "EUREKA_INSTANCE_HOST", "localhost")
        service_name = "user-service"
        # Stable instance-id (host:app:port) so a restart renews the same lease
        # instead of registering a second, duplicate instance.
        instance_id = f"{instance_host}:{service_name}:{service_port}"

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(
            eureka_client.init_async(
                eureka_server=eureka_server,
                app_name=service_name,
                instance_id=instance_id,
                instance_host=instance_host,
                instance_port=service_port,
                status_page_url=f"http://{instance_host}:{service_port}/api/docs/",
                health_check_url=f"http://{instance_host}:{service_port}/api/auth/health/",
            )
        )
        logger.info(f"Registered {service_name} with Eureka Discovery at {eureka_server}")

        atexit.register(_deregister_eureka, loop)
    except Exception as ex:
        logger.warning(f"Eureka discovery registration skipped or failed: {ex}")


def _deregister_eureka(loop):
    try:
        import py_eureka_client.eureka_client as eureka_client

        loop.run_until_complete(eureka_client.stop_async())
        logger.info("Deregistered user-service from Eureka Discovery")
    except Exception as ex:
        logger.warning(f"Eureka deregistration failed: {ex}")
