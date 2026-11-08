<?php

namespace Launchpad\Common\Security;

use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Fixtures\FixtureUsers;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

/**
 * DEV UNIQUEMENT (branché dans services.yaml sous when@dev) : permet de tester l'API
 * depuis Swagger sans Keycloak. Le jeton est un alias d'utilisateur des fixtures
 * (ex. "sonia", "amine", "nadia") ; tout autre jeton est transmis au handler OIDC Keycloak.
 */
final class DevAccessTokenHandler implements AccessTokenHandlerInterface
{
    /** @var array<string, array{0: string, 1: UserRole, 2: string, 3: string}> alias => [sub, rôle, prénom, nom] */
    private const USERS = [
        'sonia' => [FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, 'Sonia', 'Ben Ammar'],
        'karim' => [FixtureUsers::ACCOUNTANT_KARIM, UserRole::ACCOUNTANT, 'Karim', 'Trabelsi'],
        'claire' => [FixtureUsers::ACCOUNTANT_CLAIRE, UserRole::ACCOUNTANT, 'Claire', 'Dubois'],
        'youssef' => [FixtureUsers::ACCOUNTANT_YOUSSEF, UserRole::ACCOUNTANT, 'Youssef', 'Mansouri'],
        'amine' => [FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'Amine', 'Jaziri'],
        'leila' => [FixtureUsers::ENTREPRENEUR_LEILA, UserRole::ENTREPRENEUR, 'Leïla', 'Haddad'],
        'thomas' => [FixtureUsers::ENTREPRENEUR_THOMAS, UserRole::ENTREPRENEUR, 'Thomas', 'Moreau'],
        'nadia' => [FixtureUsers::ADMIN_NADIA, UserRole::ADMIN, 'Nadia', 'Khelifi'],
    ];

    public function __construct(
        private readonly AccessTokenHandlerInterface $inner,
        private readonly string $accountantRoleName,
        private readonly string $entrepreneurRoleName,
        private readonly string $adminRoleName,
    ) {
    }

    public function getUserBadgeFrom(#[\SensitiveParameter] string $accessToken): UserBadge
    {
        $user = self::USERS[strtolower(trim($accessToken))] ?? null;
        if (null === $user) {
            return $this->inner->getUserBadgeFrom($accessToken);
        }

        [$sub, $role, $firstName, $lastName] = $user;
        $keycloakRole = match ($role) {
            UserRole::ACCOUNTANT => $this->accountantRoleName,
            UserRole::ENTREPRENEUR => $this->entrepreneurRoleName,
            UserRole::ADMIN => $this->adminRoleName,
        };

        // Mêmes claims qu'un jeton Keycloak : KeycloakUserProvider construit l'utilisateur comme d'habitude
        return new UserBadge($sub, null, [
            'sub' => $sub,
            'realm_access' => ['roles' => [$keycloakRole]],
            'given_name' => $firstName,
            'family_name' => $lastName,
            'preferred_username' => strtolower(trim($accessToken)),
            'email' => strtolower(trim($accessToken)).'@launchpad.local',
        ]);
    }
}
