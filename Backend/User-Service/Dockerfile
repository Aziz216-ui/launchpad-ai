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

# Au démarrage : migrations, puis comptes de démo créés ou réparés des deux côtés (Keycloak + base,
# idempotent : un Keycloak réinitialisé est resynchronisé). Le seed attend jusqu'à 120 s que
# Keycloak réponde ; s'il échoue, le service démarre quand même (message dans les logs).
CMD ["sh", "-c", "python manage.py migrate --noinput && if [ \"$SEED_DEMO_USERS\" = \"true\" ]; then python manage.py seed_demo_users --attendre 120 || echo 'seed_demo_users en echec : comptes de demo non synchronises'; fi && (python manage.py sync_accountant_workspaces || true) && gunicorn user_service.wsgi:application --bind 0.0.0.0:${PORT:-8001} --workers 3"]
