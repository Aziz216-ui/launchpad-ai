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

## Running the Server

```powershell
# From Backend/User-Service
.\venv\Scripts\activate
python manage.py runserver 8001
```

