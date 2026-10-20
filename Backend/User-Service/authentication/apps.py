import os
import sys
import logging
import threading
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "authentication"

    def ready(self):
        # Prevent registration during database migrations or shell commands
        commands = sys.argv
        is_server = any(cmd in commands for cmd in ["runserver", "gunicorn", "uvicorn", "waitress"]) or ("runserver" in commands)

        # In runserver dev mode, only register from the reloader child process to avoid duplicate registration
        is_reloader = os.environ.get("RUN_MAIN") == "true"

        from django.conf import settings
        eureka_enabled = getattr(settings, "EUREKA_ENABLED", True)

        if eureka_enabled and (is_reloader or (is_server and not any("runserver" in c for c in commands))):
            def register_eureka():
                try:
                    import py_eureka_client.eureka_client as eureka_client
                    import asyncio

                    eureka_server = getattr(settings, "EUREKA_SERVER_URL", "http://localhost:8761/eureka")
                    service_port = getattr(settings, "SERVICE_PORT", 8001)
                    # Dynamically detect port passed on command line (e.g. runserver 8001 or 0.0.0.0:8001)
                    for arg in commands:
                        if arg.isdigit() and len(arg) >= 4:
                            service_port = int(arg)
                        elif ":" in arg and arg.split(":")[-1].isdigit():
                            service_port = int(arg.split(":")[-1])
                    service_name = "user-service"

                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        eureka_client.init_async(
                            eureka_server=eureka_server,
                            app_name=service_name,
                            instance_port=service_port,
                            instance_host="localhost",
                            status_page_url=f"http://localhost:{service_port}/api/docs/",
                            health_check_url=f"http://localhost:{service_port}/api/auth/health/",
                        )
                    )
                    logger.info(f"Registered {service_name} with Eureka Discovery at {eureka_server}")
                except Exception as ex:
                    logger.warning(f"Eureka discovery registration skipped or failed: {ex}")

            thread = threading.Thread(target=register_eureka, daemon=True)
            thread.start()
