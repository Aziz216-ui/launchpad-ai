"""
Utilisateur connecté, lu dans le jeton Keycloak transmis par l'API Gateway.

La gateway vérifie la signature du JWT (JWT_ENABLED=true) puis transmet l'en-tête
Authorization tel quel : ici on lit seulement les claims, sans revérifier la signature
(bibliothèque standard uniquement, aucune dépendance ajoutée).

- Pas d'en-tête Authorization : appel interne entre services (AI-Service, consumers RabbitMQ,
  autres services du marché) ou JWT désactivé -> None : comportement inchangé, aucune restriction.
- En-tête présent mais illisible -> 401 (la gateway ne laisse passer que des jetons valides).

Usage dans une vue DRF :
    utilisateur = utilisateur_de(request)      # Utilisateur ou None
    proprietaire = proprietaire_a_filtrer(request)  # Utilisateur à qui limiter les données, ou None
"""

import base64
import binascii
import json
from dataclasses import dataclass

from rest_framework import status
from rest_framework.exceptions import APIException

ROLE_ADMIN = "ADMIN"


class JetonInvalide(APIException):
    """
    401 JSON {"detail": ...}. Pas AuthenticationFailed : sans classe d'authentification DRF
    sur la vue, DRF transformerait celle-ci en 403.
    """

    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Jeton invalide."
    default_code = "jeton_invalide"


@dataclass(frozen=True)
class Utilisateur:
    id: str          # claim "sub" (identifiant Keycloak)
    username: str    # claim "preferred_username"
    roles: frozenset  # realm_access.roles

    @property
    def est_admin(self):
        return ROLE_ADMIN in self.roles


def lire_claims(jeton):
    """Claims (dict) de la partie centrale d'un JWT, sans vérification de signature."""
    try:
        charge = jeton.split(".")[1]
        charge += "=" * (-len(charge) % 4)  # base64url sans padding
        claims = json.loads(base64.urlsafe_b64decode(charge))
    except (IndexError, ValueError, binascii.Error, UnicodeDecodeError) as exc:
        raise JetonInvalide("Jeton illisible.") from exc
    if not isinstance(claims, dict) or not claims.get("sub"):
        raise JetonInvalide("Jeton sans identifiant utilisateur (claim 'sub').")
    return claims


def utilisateur_de(request):
    """Utilisateur du jeton Bearer de la requête, ou None s'il n'y a pas de jeton (appel interne)."""
    entete = request.META.get("HTTP_AUTHORIZATION", "")
    if not entete:
        return None
    schema, _, jeton = entete.partition(" ")
    if schema.lower() != "bearer" or not jeton.strip():
        raise JetonInvalide("En-tête Authorization attendu : Bearer <jeton>.")
    claims = lire_claims(jeton.strip())
    roles = (claims.get("realm_access") or {}).get("roles") or []
    return Utilisateur(
        id=str(claims["sub"]),
        username=claims.get("preferred_username") or "",
        roles=frozenset(roles),
    )


def proprietaire_a_filtrer(request):
    """
    Utilisateur dont il faut limiter les données à ce qui lui appartient, ou None :
    None sans jeton (appel interne) et pour un ADMIN, qui voit tout.
    """
    utilisateur = utilisateur_de(request)
    if utilisateur is None or utilisateur.est_admin:
        return None
    return utilisateur
