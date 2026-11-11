from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6, required=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    # ADMIN exclu : l'inscription est publique, un compte ADMIN ne doit jamais pouvoir s'auto-créer
    # (il est créé par la commande seed_demo_users ou depuis la console Keycloak).
    role = serializers.ChoiceField(
        choices=[c for c in User.Role.choices if c[0] != User.Role.ADMIN],
        default=User.Role.ENTREPRENEUR,
    )

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)


class ForgotPasswordSerializer(serializers.Serializer):
    identifiant = serializers.CharField(
        max_length=254, trim_whitespace=True,
        help_text="Adresse e-mail ou nom d'utilisateur du compte.")


class ForgotPasswordResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ResetPasswordSerializer(serializers.Serializer):
    identifiant = serializers.CharField(
        max_length=254, trim_whitespace=True,
        help_text="Adresse e-mail ou nom d'utilisateur (le même que pour la demande de code).",
        error_messages={"required": "Saisissez votre e-mail ou nom d'utilisateur.",
                        "blank": "Saisissez votre e-mail ou nom d'utilisateur."})
    code = serializers.RegexField(
        r"^\d{6}$", help_text="Code à 6 chiffres reçu par e-mail.",
        error_messages={"invalid": "Le code doit contenir 6 chiffres.",
                        "required": "Saisissez le code reçu par e-mail.",
                        "blank": "Saisissez le code reçu par e-mail."})
    nouveau_mot_de_passe = serializers.CharField(
        write_only=True, trim_whitespace=False, max_length=128,
        help_text="Au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.",
        error_messages={"required": "Saisissez un nouveau mot de passe.",
                        "blank": "Saisissez un nouveau mot de passe."})


class ResetPasswordResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class ResetPasswordErrorSerializer(serializers.Serializer):
    error = serializers.CharField(help_text="Message en français, à afficher.")
    code_erreur = serializers.ChoiceField(
        choices=["code_invalide", "code_expire", "trop_essais", "mot_de_passe_faible", "champs_invalides"])


class RefreshTokenSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=True)


class LogoutSerializer(serializers.Serializer):
    refresh_token = serializers.CharField(required=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "keycloak_id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "keycloak_id", "created_at", "updated_at"]


class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone_number"]


class RegisterResponseSerializer(serializers.Serializer):
    message = serializers.CharField()
    user = UserSerializer()


class LoginResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    token_type = serializers.CharField(default="Bearer")
    expires_in = serializers.IntegerField()
    refresh_expires_in = serializers.IntegerField()
    user = UserSerializer(allow_null=True)


class LogoutResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class HealthCheckResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    database_connected = serializers.BooleanField()
    keycloak_connected = serializers.BooleanField()
