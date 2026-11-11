# Launchpad User Service (Django + Keycloak + PostgreSQL)

This service manages user registration, login, token refresh, and profile management using **Keycloak** as the Identity and Access Management (IAM) provider and **PostgreSQL** for user persistence.

## Architecture

- **PostgreSQL Databases**:
  - `keycloak_db` (owner: `keycloak_user`): Stores all Keycloak realms, clients, credentials, and sessions.
  - `launchpad` (owner: `app_user`): Stores the application user profile table (`users`), mapped to Keycloak via `keycloak_id`.
- **Keycloak (Quarkus v26.8.1 in Docker)**:
  - Port: `8080`
  - Realm: `launchpad`
  - Client ID: `launchpad-client`
  - Realm Roles: `user`, `lawyer`, `admin`
- **Django User Service**:
  - Custom User Model: [`authentication.User`](./authentication/models.py)
  - Keycloak Authentication Backend: [`authentication.authentication.KeycloakAuthentication`](./authentication/authentication.py)

---

## API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/auth/health/` | Checks DB and Keycloak health status | No |
| `POST` | `/api/auth/register/` | Registers user in Keycloak and syncs to PostgreSQL | No |
| `POST` | `/api/auth/login/` | Authenticates via Keycloak, returns tokens | No |
| `POST` | `/api/auth/refresh/` | Exchanges refresh token for new access token | No |
| `POST` | `/api/auth/logout/` | Logs out user and invalidates session in Keycloak | No |
| `GET` | `/api/auth/profile/` | Retrieves authenticated user profile | Bearer Token |
| `PATCH` | `/api/auth/profile/` | Updates user details (first/last name, phone) | Bearer Token |

---

## Interactive API Documentation (Swagger & OpenAPI)

- **Swagger UI**: [http://localhost:8001/api/docs/](http://localhost:8001/api/docs/)
- **ReDoc UI**: [http://localhost:8001/api/redoc/](http://localhost:8001/api/redoc/)
- **OpenAPI 3.0 Schema**: [http://localhost:8001/api/schema/](http://localhost:8001/api/schema/)

---

## Service Discovery (Eureka)

This service automatically registers with **Eureka Discovery Server** on startup:
- **Application Name**: `user-service`
- **Default Eureka Server**: `http://localhost:8761/eureka`
- **Status / Documentation Page**: `http://localhost:8001/api/docs/`
- **Health Check Endpoint**: `http://localhost:8001/api/auth/health/`

---

## Running the Server (local, without Docker)

```powershell
# From Backend/User-Service
.\venv\Scripts\activate
python manage.py runserver 8001
```

## Running with Docker (recommended)

```bash
# From Backend/User-Service
cp .env.example .env   # fill in real secrets, never commit .env
docker compose up -d --build
```

This starts, in order: the `launchpad` Postgres database, Keycloak (with its own
`keycloak_db` database), a one-shot `keycloak-init` service that runs
`setup_keycloak.py` (idempotent: creates the `launchpad` realm, the
`launchpad-client` client and the `user`/`lawyer`/`admin` roles only if they
don't already exist), and finally the Django app itself via gunicorn.

Default host ports (override via `.env`, see `.env.example`):
- `8001` — Django API (matches the API Gateway's `USER_SERVICE_URI`)
- `8180` — Keycloak admin console / API (`8080` is already used by the API Gateway setup)
- `5439` — Postgres (`launchpad` db)

`keycloak_db` is not exposed to the host; only the Keycloak container talks to it.

## Synchronisation Keycloak <-> base

Keycloak est la source de vérité pour l'authentification (comptes, mots de passe, rôles du realm) ;
la table `users` garde le profil, relié au compte par `keycloak_id`. Un compte est retrouvé par
`keycloak_id`, sinon par `username` : après une réinitialisation de Keycloak, le profil existant est
relié au nouveau compte, jamais dupliqué. Code : [`authentication/synchronisation.py`](./authentication/synchronisation.py).

| Quand | Ce qui est fait |
|---|---|
| Connexion (`/api/auth/login/`) et chaque requête authentifiée | Profil absent : créé à partir du jeton (`sub`, `preferred_username`, `email`, rôle du realm). Profil d'un ancien compte : `keycloak_id` mis à jour. Rôle aligné sur le jeton. |
| Démarrage du conteneur (`SEED_DEMO_USERS=true`) | `seed_demo_users --attendre 120` : comptes de démo créés ou réparés des deux côtés (absent de Keycloak : recréé avec son mot de passe de démo ; absent de la base : profil créé ; rôle corrigé). |
| À la demande | `python manage.py sync_keycloak [--dry-run]` : rapport des écarts et corrections. |

`sync_keycloak` :
- profil sans compte Keycloak : compte recréé avec un **mot de passe temporaire** (affiché une seule
  fois dans le rapport) et l'action requise `UPDATE_PASSWORD` ; comptes de démo : mot de passe de démo ;
- compte Keycloak sans profil : profil créé ;
- `keycloak_id` différent : corrigé ; rôles différents : Keycloak fait foi (sauf compte sans rôle
  applicatif dans Keycloak, qui reçoit celui de la base, et comptes de démo, dont le rôle est imposé).

Un compte recréé avec `UPDATE_PASSWORD` ne peut pas se connecter par `/api/auth/login/` (grant
« password ») tant que le mot de passe n'a pas été changé, par exemple dans la console compte de
Keycloak : http://localhost:8180/realms/launchpad/account

```bash
docker exec user-service python manage.py sync_keycloak --dry-run   # voir les écarts
docker exec user-service python manage.py sync_keycloak             # les corriger
docker exec user-service python manage.py seed_demo_users           # réparer les comptes de démo
```

## Running the tests

```bash
python manage.py test authentication
```

