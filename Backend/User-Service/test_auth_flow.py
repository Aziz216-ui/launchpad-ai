import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "user_service.settings")
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()

def test_flow():
    client = APIClient()
    test_username = "test_lawyer_01"
    test_email = "test_lawyer_01@example.com"
    test_password = "Password123!"

    print("=== 1. Testing Health Check ===")
    res = client.get("/api/auth/health/")
    print(f"Health check status: {res.status_code}, data: {res.data}")
    assert res.status_code == 200, "Health check failed"

    # Cleanup test user if exists from prior runs
    existing = User.objects.filter(username=test_username).first()
    if existing:
        from authentication.keycloak_client import KeycloakService
        ks = KeycloakService()
        try:
            admin = ks.get_admin_client()
            admin.delete_user(existing.keycloak_id)
        except Exception:
            pass
        existing.delete()

    print("\n=== 2. Testing User Registration (Lawyer Role) ===")
    reg_payload = {
        "username": test_username,
        "email": test_email,
        "password": test_password,
        "first_name": "Jean",
        "last_name": "Dupont",
        "phone_number": "+33612345678",
        "role": "lawyer"
    }
    res = client.post("/api/auth/register/", reg_payload, format="json")
    print(f"Register status: {res.status_code}, response: {res.data}")
    assert res.status_code == 201, f"Registration failed: {res.data}"
    keycloak_id = res.data["user"]["keycloak_id"]
    print(f"User created with Keycloak ID: {keycloak_id}")

    # Check PostgreSQL database
    user_in_db = User.objects.get(username=test_username)
    print(f"PostgreSQL user record: id={user_in_db.id}, email={user_in_db.email}, role={user_in_db.role}")
    assert user_in_db.keycloak_id == keycloak_id

    print("\n=== 3. Testing User Login ===")
    login_payload = {
        "username": test_username,
        "password": test_password
    }
    res = client.post("/api/auth/login/", login_payload, format="json")
    print(f"Login status: {res.status_code}")
    assert res.status_code == 200, f"Login failed: {res.data}"
    access_token = res.data.get("access_token")
    refresh_token = res.data.get("refresh_token")
    print(f"Received access_token: {access_token[:30]}...")
    print(f"Received refresh_token: {refresh_token[:30]}...")

    print("\n=== 4. Testing Authenticated Profile Retrieval ===")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    res = client.get("/api/auth/profile/")
    print(f"Profile status: {res.status_code}, data: {res.data}")
    assert res.status_code == 200, f"Profile failed: {res.data}"
    assert res.data["username"] == test_username
    assert res.data["role"] == "lawyer"

    print("\n=== 5. Testing Profile Update ===")
    patch_payload = {"phone_number": "+33699887766"}
    res = client.patch("/api/auth/profile/", patch_payload, format="json")
    print(f"Patch profile status: {res.status_code}, updated phone: {res.data.get('phone_number')}")
    assert res.status_code == 200
    assert res.data["phone_number"] == "+33699887766"

    print("\n=== 6. Testing Token Refresh ===")
    client.credentials()  # Reset auth header
    res = client.post("/api/auth/refresh/", {"refresh_token": refresh_token}, format="json")
    print(f"Refresh token status: {res.status_code}")
    assert res.status_code == 200, f"Refresh failed: {res.data}"
    new_access_token = res.data.get("access_token")
    print(f"New access token: {new_access_token[:30]}...")

    print("\n=== 7. Testing Logout ===")
    res = client.post("/api/auth/logout/", {"refresh_token": refresh_token}, format="json")
    print(f"Logout status: {res.status_code}, message: {res.data}")
    assert res.status_code == 200, f"Logout failed: {res.data}"

    print("\n ALL AUTHENTICATION FLOW TESTS PASSED!")

if __name__ == "__main__":
    test_flow()
