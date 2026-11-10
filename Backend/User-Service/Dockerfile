# Image du User-Service LaunchPad AI (Django + Keycloak, Python 3.12)
FROM python:3.12-slim
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN groupadd --system django && useradd --system --gid django django \
    && chown -R django:django /app
USER django

EXPOSE 8001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",\"8001\")}/api/auth/health/', timeout=3)"

CMD ["sh", "-c", "python manage.py migrate --noinput && if [ \"$SEED_DEMO_USERS\" = \"true\" ]; then python manage.py seed_demo_users || true; fi && (python manage.py sync_accountant_workspaces || true) && gunicorn user_service.wsgi:application --bind 0.0.0.0:${PORT:-8001} --workers 3"]
