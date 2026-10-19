<?php

namespace App\Tests\Unit;

use App\Security\KeycloakRoleMapper;
use PHPUnit\Framework\TestCase;

final class KeycloakRoleMapperTest extends TestCase
{
    public function testMapsRealmRolesUsingConfiguredNames(): void
    {
        $mapper = new KeycloakRoleMapper('launchpad-app', false, 'comptable', 'entrepreneur', 'admin');

        $roles = $mapper->map(['realm_access' => ['roles' => ['comptable', 'offline_access', 'uma_authorization']]]);

        self::assertSame(['ROLE_ACCOUNTANT'], $roles);
    }

    public function testIgnoresClientRolesWhenDisabled(): void
    {
        $mapper = new KeycloakRoleMapper('launchpad-app', false, 'ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN');

        self::assertSame([], $mapper->map(['resource_access' => ['launchpad-app' => ['roles' => ['ADMIN']]]]));
    }

    public function testReadsClientRolesOfConfiguredClientWhenEnabled(): void
    {
        $mapper = new KeycloakRoleMapper('launchpad-app', true, 'ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN');

        $roles = $mapper->map([
            'realm_access' => ['roles' => ['ENTREPRENEUR']],
            'resource_access' => [
                'launchpad-app' => ['roles' => ['ADMIN', 'ENTREPRENEUR']],
                'other-client' => ['roles' => ['ACCOUNTANT']],
            ],
        ]);

        self::assertSame(['ROLE_ENTREPRENEUR', 'ROLE_ADMIN'], $roles);
    }

    public function testToleratesMissingOrMalformedClaims(): void
    {
        $mapper = new KeycloakRoleMapper('launchpad-app', true, 'ACCOUNTANT', 'ENTREPRENEUR', 'ADMIN');

        self::assertSame([], $mapper->map([]));
        self::assertSame([], $mapper->map(['realm_access' => ['roles' => 'ADMIN'], 'resource_access' => 'x']));
    }
}
