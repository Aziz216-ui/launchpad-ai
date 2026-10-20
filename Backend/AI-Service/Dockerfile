FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8085

# --workers 1 : evite la multi-registration Eureka sous gunicorn multi-process.
# Si tu veux plusieurs workers, utilise un proxy Eureka ou un singleton partagé.
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8085", "--workers", "1", "--timeout", "120"]
