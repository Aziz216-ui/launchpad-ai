import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.db import transaction
from keycloak.exceptions import KeycloakError
from drf_spectacular.utils import extend_schema, OpenApiResponse

from .events import publier_comptable_inscrit
from .keycloak_client import KeycloakService
from .synchronisation import provisionner_profil
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    RefreshTokenSerializer,
    LogoutSerializer,
    UserSerializer,
    UpdateProfileSerializer,
    RegisterResponseSerializer,
    LoginResponseSerializer,
    LogoutResponseSerializer,
    HealthCheckResponseSerializer,
    ForgotPasswordSerializer,
    ForgotPasswordResponseSerializer,
    ResetPasswordSerializer,
    ResetPasswordResponseSerializer,
    ResetPasswordErrorSerializer,
)
from . import reinitialisation

logger = logging.getLogger(__name__)
User = get_user_model()


class ForgotPasswordView(APIView):
    """
    « Mot de passe oublié », étape 1 : code envoyé par e-mail. Public, même réponse que le compte
    existe ou non (voir authentication/reinitialisation.py). Pas d'authentification : un jeton
    expiré envoyé par le navigateur ne doit pas provoquer de 401.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Authentication"],
        summary="Forgot password (envoi d'un code)",
        description=(
            "Envoie par e-mail un code à 6 chiffres valable 10 minutes si un compte correspond à "
            "l'e-mail ou au nom d'utilisateur (une nouvelle demande annule le code précédent). Réponse "
            "identique que le compte existe ou non ; au plus 3 demandes par e-mail et par 15 minutes."
        ),
        request=ForgotPasswordSerializer,
        responses={
            200: ForgotPasswordResponseSerializer,
            400: OpenApiResponse(description="Identifiant manquant"),
            503: OpenApiResponse(description="Keycloak injoignable"),
        },
    )
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            reinitialisation.demander_code(serializer.validated_data["identifiant"])
        except Exception as e:
            logger.error(f"Mot de passe oublié : Keycloak injoignable ({e})")
            return Response({"error": "Service temporairement indisponible, réessayez plus tard."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"message": reinitialisation.MESSAGE}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """« Mot de passe oublié », étape 2 : code reçu + nouveau mot de passe. Public."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Authentication"],
        summary="Reset password (code reçu par e-mail)",
        description=(
            "Vérifie le code (expiration 10 min, au plus 5 essais, ensuite le code est annulé) et la "
            "force du mot de passe (8 caractères, une majuscule, un chiffre, un caractère spécial), "
            "puis change le mot de passe dans Keycloak. Erreurs : code_erreur = code_invalide, "
            "code_expire, trop_essais, mot_de_passe_faible ou champs_invalides."
        ),
        request=ResetPasswordSerializer,
        responses={
            200: ResetPasswordResponseSerializer,
            400: ResetPasswordErrorSerializer,
            503: OpenApiResponse(description="Keycloak injoignable"),
        },
    )
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            premier = next(iter(serializer.errors.values()))[0]
            return Response({"error": str(premier), "code_erreur": "champs_invalides",
                             "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        donnees = serializer.validated_data
        try:
            reinitialisation.reinitialiser(donnees["identifiant"], donnees["code"], donnees["nouveau_mot_de_passe"])
        except reinitialisation.ErreurReinitialisation as e:
            return Response({"error": e.message, "code_erreur": e.code_erreur}, status=status.HTTP_400_BAD_REQUEST)
        except KeycloakError as e:
            # Ex. politique de mot de passe du realm plus stricte : message de Keycloak
            logger.warning(f"Réinitialisation refusée par Keycloak : {e}")
            return Response({"error": "Mot de passe refusé par le serveur d'authentification.",
                             "code_erreur": "mot_de_passe_faible"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Réinitialisation : Keycloak injoignable ({e})")
            return Response({"error": "Service temporairement indisponible, réessayez plus tard."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"message": "Votre mot de passe a été modifié. Vous pouvez vous connecter."},
                        status=status.HTTP_200_OK)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Register new user",
        description="Registers a user in Keycloak (credentials + role) and syncs user record to PostgreSQL.",
        request=RegisterSerializer,
        responses={
            201: RegisterResponseSerializer,
            400: OpenApiResponse(description="Bad request or validation error"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        keycloak_service = KeycloakService()

        try:
            # 1. Register user in Keycloak
            keycloak_id = keycloak_service.register_user(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                role=data.get("role", User.Role.ENTREPRENEUR)
            )

            # 2. Persist user in PostgreSQL
            with transaction.atomic():
                user = User.objects.create(
                    keycloak_id=keycloak_id,
                    username=data["username"],
                    email=data["email"],
                    first_name=data.get("first_name", ""),
                    last_name=data.get("last_name", ""),
                    phone_number=data.get("phone_number", ""),
                    role=data.get("role", User.Role.ENTREPRENEUR),
                )
                # Comptable : workspace-service crée son espace (annuaire des entrepreneurs), voir events.py
                if user.role == User.Role.ACCOUNTANT:
                    transaction.on_commit(lambda: publier_comptable_inscrit(user))

            return Response(
                {
                    "message": "User registered successfully",
                    "user": UserSerializer(user).data
                },
                status=status.HTTP_201_CREATED
            )

        except KeycloakError as e:
            logger.error(f"Keycloak registration error: {e}")
            error_message = getattr(e, "error_message", str(e))
            return Response(
                {"error": "Keycloak registration failed", "details": error_message},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected registration error: {e}")
            return Response(
                {"error": "Internal server error during registration", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="User login",
        description="Authenticates credentials with Keycloak using OpenID Connect and returns JWT access and refresh tokens.",
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            401: OpenApiResponse(description="Invalid credentials"),
            500: OpenApiResponse(description="Internal server error"),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]
        keycloak_service = KeycloakService()

        try:
            token_response = keycloak_service.login_user(username, password)
            user = self._profil(keycloak_service, token_response.get("access_token"), username)
            user_data = UserSerializer(user).data if user else None

            return Response(
                {
                    "access_token": token_response.get("access_token"),
                    "refresh_token": token_response.get("refresh_token"),
                    "token_type": token_response.get("token_type", "Bearer"),
                    "expires_in": token_response.get("expires_in"),
                    "refresh_expires_in": token_response.get("refresh_expires_in"),
                    "user": user_data
                },
                status=status.HTTP_200_OK
            )

        except KeycloakError as e:
            logger.warning(f"Keycloak login failed for {username}: {e}")
            return Response(
                {"error": "Invalid credentials or login failed", "details": str(e)},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Unexpected login error: {e}")
            return Response(
                {"error": "Internal login error", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @staticmethod
    def _profil(keycloak_service, access_token, username):
        """
        Profil local de l'utilisateur connecté : créé ou relié à partir du jeton s'il manque
        (Keycloak est la source de vérité). Si le jeton ne peut pas être lu, la connexion
        réussit quand même avec le profil trouvé par username (ou aucun).
        """
        try:
            return provisionner_profil(keycloak_service.verify_token(access_token))
        except Exception as e:
            logger.warning(f"Provisioning du profil impossible pour {username}: {e}")
            return User.objects.filter(username__iexact=username).first()


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Refresh access token",
        description="Obtains a new access token using an existing valid refresh token.",
        request=RefreshTokenSerializer,
        responses={
            200: OpenApiResponse(description="Token refresh successful"),
            400: OpenApiResponse(description="Invalid refresh token"),
        },
    )
    def post(self, request):
        serializer = RefreshTokenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        refresh_token = serializer.validated_data["refresh_token"]
        keycloak_service = KeycloakService()

        try:
            tokens = keycloak_service.refresh_user_token(refresh_token)
            return Response(tokens, status=status.HTTP_200_OK)
        except KeycloakError as e:
            return Response(
                {"error": "Could not refresh token", "details": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class LogoutView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="User logout",
        description="Revokes the refresh token and ends the user session in Keycloak.",
        request=LogoutSerializer,
        responses={
            200: LogoutResponseSerializer,
            400: OpenApiResponse(description="Logout failed"),
        },
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        refresh_token = serializer.validated_data["refresh_token"]
        keycloak_service = KeycloakService()

        try:
            keycloak_service.logout_user(refresh_token)
            return Response({"message": "Successfully logged out from Keycloak."}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": "Logout failed", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Profile"],
        summary="Get user profile",
        description="Retrieves the current authenticated user's profile details.",
        responses={
            200: UserSerializer,
            401: OpenApiResponse(description="Unauthorized or invalid token"),
        },
    )
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Profile"],
        summary="Update user profile",
        description="Partially updates profile information (first_name, last_name, phone_number).",
        request=UpdateProfileSerializer,
        responses={
            200: UserSerializer,
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Unauthorized"),
        },
    )
    def patch(self, request):
        serializer = UpdateProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Health"],
        summary="Service health check",
        description="Checks database and Keycloak service connectivity status.",
        responses={
            200: HealthCheckResponseSerializer,
            503: HealthCheckResponseSerializer,
        },
    )
    def get(self, request):
        db_ok = True
        try:
            User.objects.count()
        except Exception as e:
            db_ok = False

        keycloak_ok = True
        try:
            KeycloakService().get_openid_client().well_known()
        except Exception as e:
            keycloak_ok = False

        return Response(
            {
                "status": "healthy" if (db_ok and keycloak_ok) else "degraded",
                "database_connected": db_ok,
                "keycloak_connected": keycloak_ok,
            },
            status=status.HTTP_200_OK if (db_ok and keycloak_ok) else status.HTTP_503_SERVICE_UNAVAILABLE
        )


class LawyerListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lawyers = User.objects.filter(role=User.Role.LAWYER).values(
            "id", "username", "email", "first_name", "last_name", "phone_number", "role"
        )
        return Response(list(lawyers), status=status.HTTP_200_OK)

