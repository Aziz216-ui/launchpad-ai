<?php

namespace App\Security;

use Symfony\Component\Security\Core\Exception\UnsupportedUserException;
use Symfony\Component\Security\Core\Exception\UserNotFoundException;
use Symfony\Component\Security\Core\User\AttributesBasedUserProviderInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Construit l'utilisateur à partir des claims du jeton déjà vérifié par le handler OIDC
 * (signature, exp, iss, aud). Aucune base d'utilisateurs locale.
 *
 * @implements AttributesBasedUserProviderInterface<KeycloakUser>
 */
final class KeycloakUserProvider implements AttributesBasedUserProviderInterface
{
    public function __construct(private readonly KeycloakRoleMapper $roleMapper)
    {
    }

    /**
     * @param array<string, mixed> $attributes claims du JWT
     */
    public function loadUserByIdentifier(string $identifier, array $attributes = []): UserInterface
    {
        if ([] === $attributes) {
            // Pas de jeton : impossible de reconstruire l'utilisateur (API stateless)
            throw new UserNotFoundException();
        }

        return new KeycloakUser(
            id: $identifier,
            roles: $this->roleMapper->map($attributes),
            email: $this->optionalString($attributes, 'email'),
            firstName: $this->optionalString($attributes, 'given_name'),
            lastName: $this->optionalString($attributes, 'family_name'),
            username: $this->optionalString($attributes, 'preferred_username'),
        );
    }

    public function refreshUser(UserInterface $user): UserInterface
    {
        // Firewall stateless : l'utilisateur n'est jamais rechargé depuis une session
        throw new UnsupportedUserException('Stateless API: users are never refreshed.');
    }

    public function supportsClass(string $class): bool
    {
        return KeycloakUser::class === $class;
    }

    /**
     * @param array<string, mixed> $claims
     */
    private function optionalString(array $claims, string $name): ?string
    {
        $value = $claims[$name] ?? null;

        return \is_string($value) && '' !== $value ? $value : null;
    }
}
