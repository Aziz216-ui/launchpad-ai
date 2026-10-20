import os
import sys
from keycloak import KeycloakAdmin

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080/")
ADMIN_USERNAME = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")
TARGET_REALM = "launchpad"
CLIENT_ID = "launchpad-client"

def setup():
    print(f"Connecting to Keycloak at {KEYCLOAK_URL} as {ADMIN_USERNAME}...")
    keycloak_admin = KeycloakAdmin(
        server_url=KEYCLOAK_URL,
        username=ADMIN_USERNAME,
        password=ADMIN_PASSWORD,
        realm_name="master",
        verify=True
    )

    # 1. Check/create realm
    realms = [r["realm"] for r in keycloak_admin.get_realms()]
    if TARGET_REALM not in realms:
        print(f"Creating realm '{TARGET_REALM}'...")
        keycloak_admin.create_realm({
            "realm": TARGET_REALM,
            "enabled": True,
            "displayName": "Launchpad Realm",
            "registrationAllowed": True,
            "resetPasswordAllowed": True,
            "rememberMe": True
        })
        print(f"Realm '{TARGET_REALM}' created.")
    else:
        print(f"Realm '{TARGET_REALM}' already exists.")

    # Switch admin context to target realm
    admin_launchpad = KeycloakAdmin(
        server_url=KEYCLOAK_URL,
        username=ADMIN_USERNAME,
        password=ADMIN_PASSWORD,
        realm_name=TARGET_REALM,
        user_realm_name="master",
        verify=True
    )

    # 2. Check/create roles
    existing_roles = [r["name"] for r in admin_launchpad.get_realm_roles()]
    for role in ["user", "lawyer", "admin"]:
        if role not in existing_roles:
            print(f"Creating realm role '{role}'...")
            admin_launchpad.create_realm_role({"name": role, "description": f"{role.capitalize()} role"})
        else:
            print(f"Realm role '{role}' already exists.")

    # 3. Check/create client
    clients = admin_launchpad.get_clients()
    client_obj = next((c for c in clients if c["clientId"] == CLIENT_ID), None)
    
    if not client_obj:
        print(f"Creating client '{CLIENT_ID}'...")
        client_payload = {
            "clientId": CLIENT_ID,
            "name": "Launchpad Client",
            "enabled": True,
            "publicClient": False,
            "directAccessGrantsEnabled": True,
            "standardFlowEnabled": True,
            "serviceAccountsEnabled": True,
            "authorizationServicesEnabled": True,
            "redirectUris": ["http://localhost:*", "http://127.0.0.1:*", "*"],
            "webOrigins": ["*"]
        }
        client_id_internal = admin_launchpad.create_client(client_payload)
        client_obj = admin_launchpad.get_client(client_id_internal)
        print(f"Client '{CLIENT_ID}' created with internal ID: {client_id_internal}")
    else:
        client_id_internal = client_obj["id"]
        # Ensure direct access grants and service accounts are enabled
        admin_launchpad.update_client(client_id_internal, {
            "directAccessGrantsEnabled": True,
            "serviceAccountsEnabled": True,
            "publicClient": False
        })
        print(f"Client '{CLIENT_ID}' already exists (internal ID: {client_id_internal}).")

    # Get client secret
    secrets = admin_launchpad.get_client_secrets(client_id_internal)
    client_secret = secrets.get("value")
    print(f"CLIENT_SECRET={client_secret}")

    # Assign realm-management roles to service account so Django can manage users
    service_user = admin_launchpad.get_client_service_account_user(client_id_internal)
    realm_mgmt_client = next((c for c in admin_launchpad.get_clients() if c["clientId"] == "realm-management"), None)
    if realm_mgmt_client and service_user:
        realm_mgmt_id = realm_mgmt_client["id"]
        mgmt_roles = admin_launchpad.get_client_roles(realm_mgmt_id)
        manage_users_role = next((r for r in mgmt_roles if r["name"] == "manage-users"), None)
        if manage_users_role:
            admin_launchpad.assign_client_role(
                client_id=realm_mgmt_id,
                user_id=service_user["id"],
                roles=[manage_users_role]
            )
            print("Assigned 'manage-users' role to client service account.")

    print("\nKeycloak setup completed successfully!")
    return client_secret

if __name__ == "__main__":
    setup()
