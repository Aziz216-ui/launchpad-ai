from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
import uuid

class UserManager(BaseUserManager):
    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        if not username:
            raise ValueError("The Username field must be set")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        if not extra_fields.get("keycloak_id"):
            extra_fields["keycloak_id"] = str(uuid.uuid4())
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ENTREPRENEUR = "ENTREPRENEUR", "Entrepreneur"
        LAWYER = "LAWYER", "Lawyer"
        ACCOUNTANT = "ACCOUNTANT", "Accountant"
        FINANCIER = "FINANCIER", "Financier"
        ADMIN = "ADMIN", "Admin"

    keycloak_id = models.CharField(max_length=64, unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ENTREPRENEUR)
    
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.username} ({self.role})"


class DemandeReinitialisation(models.Model):
    """
    Demande « Mot de passe oublié » (POST /api/auth/forgot-password/), pour limiter le nombre
    de demandes par e-mail. Stockée en base : la limite est partagée par tous les workers.
    cle = e-mail du compte trouvé dans Keycloak, sinon l'identifiant saisi (en minuscules).
    """

    cle = models.CharField(max_length=254, db_index=True)
    date = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "demandes_reinitialisation"
        verbose_name = "Demande de réinitialisation"

    def __str__(self):
        return f"{self.cle} ({self.date:%Y-%m-%d %H:%M})"


class CodeReinitialisation(models.Model):
    """
    Code « Mot de passe oublié » envoyé par e-mail. Un seul code actif par compte Keycloak
    (une nouvelle demande remplace l'ancien) ; seul son haché (HMAC-SHA256) est stocké.
    Annulé après PASSWORD_RESET_MAX_ATTEMPTS essais faux ; supprimé une fois utilisé.
    """

    keycloak_id = models.CharField(max_length=64, unique=True)
    code_hache = models.CharField(max_length=64)
    expire_le = models.DateTimeField()
    essais = models.PositiveSmallIntegerField(default=0)
    cree_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "codes_reinitialisation"
        verbose_name = "Code de réinitialisation"

    def __str__(self):
        return f"code de {self.keycloak_id} (expire {self.expire_le:%Y-%m-%d %H:%M})"
