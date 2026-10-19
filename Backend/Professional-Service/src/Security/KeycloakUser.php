<?php

namespace App\Security;

use App\Enum\UserRole;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Utilisateur authentifié, construit à partir des claims du jeton Keycloak.
 * Rien n'est stocké en base : le Service Utilisateurs (Keycloak) reste la source de vérité.
 */
final class KeycloakUser implements UserInterface
{
    /**
     * @param list<string> $roles rôles Symfony (ROLE_ACCOUNTANT, ...)
     */
    public function __construct(
        private readonly string $id,
        private readonly array $roles,
        private readonly ?string $email = null,
        private readonly ?string $firstName = null,
        private readonly ?string $lastName = null,
        private readonly ?string $username = null,
    ) {
    }

    /** Claim "sub" : identifiant stocké dans entrepreneurId, accountantId, etc. */
    public function getId(): string
    {
        return $this->id;
    }

    public function getUserIdentifier(): string
    {
        return $this->id;
    }

    public function getRoles(): array
    {
        return $this->roles;
    }

    public function hasRole(UserRole $role): bool
    {
        return \in_array($role->securityRole(), $this->roles, true);
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function getUsername(): ?string
    {
        return $this->username;
    }

    /** Nom à afficher : prénom + nom, sinon identifiant de connexion, sinon email. */
    public function getDisplayName(): string
    {
        $fullName = trim(($this->firstName ?? '').' '.($this->lastName ?? ''));

        return $fullName ?: ($this->username ?? $this->email ?? $this->id);
    }

    #[\Deprecated]
    public function eraseCredentials(): void
    {
    }
}
