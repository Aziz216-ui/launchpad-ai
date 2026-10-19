<?php

namespace App\Tests\Functional;

use App\DataFixtures\FixtureUsers;
use App\Tests\Security\TestKeys;
use App\Tests\Security\TestTokenFactory;

/**
 * Validation du JWT Keycloak (signature, exp, iss, aud) et correspondance des rôles.
 */
final class SecurityTest extends ApiTestCase
{
    public function testHealthIsPublic(): void
    {
        $data = $this->request('GET', '/health');

        $this->assertStatus(200);
        self::assertSame('UP', $data['status']);
    }

    public function testMissingTokenReturns401Json(): void
    {
        $this->request('GET', '/files');

        $this->assertError(401, 'UNAUTHORIZED');
        self::assertSame('Bearer', $this->client->getResponse()->headers->get('WWW-Authenticate'));
    }

    public function testMalformedTokenReturns401(): void
    {
        $this->withToken('pas.un.jwt')->request('GET', '/files');

        $this->assertError(401, 'INVALID_TOKEN');
    }

    public function testTokenSignedWithUnknownKeyIsRejected(): void
    {
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, ['ENTREPRENEUR'], signingKey: TestKeys::foreignKey());
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(401, 'INVALID_TOKEN');
    }

    public function testExpiredTokenIsRejected(): void
    {
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, ['ENTREPRENEUR'], ['iat' => time() - 3600, 'exp' => time() - 1800]);
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(401, 'INVALID_TOKEN');
    }

    public function testTokenFromAnotherIssuerIsRejected(): void
    {
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, ['ENTREPRENEUR'], ['iss' => 'http://evil.test/realms/launchpad']);
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(401, 'INVALID_TOKEN');
    }

    public function testTokenWithoutExpectedAudienceIsRejected(): void
    {
        // Jeton Keycloak par défaut (aud = "account") : l'Audience mapper n'a pas été configuré
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, ['ENTREPRENEUR'], ['aud' => 'account']);
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(401, 'INVALID_TOKEN');
    }

    public function testValidTokenWithoutBusinessRoleIsForbidden(): void
    {
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, ['some-other-role']);
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testClientRolesAreIgnoredWhenDisabled(): void
    {
        // KEYCLOAK_USE_CLIENT_ROLES=false en test : seul realm_access.roles compte
        $token = TestTokenFactory::create(FixtureUsers::ENTREPRENEUR_AMINE, [], [
            'resource_access' => ['launchpad-app' => ['roles' => ['ENTREPRENEUR']]],
        ]);
        $this->withToken($token)->request('GET', '/files');

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testMeExposesIdentityAndMappedRoles(): void
    {
        $data = $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', '/me')['data'];

        $this->assertStatus(200);
        self::assertSame(FixtureUsers::ACCOUNTANT_SONIA, $data['id']);
        self::assertSame(['ROLE_ACCOUNTANT'], $data['roles']);
        self::assertSame('Sonia Ben Ammar', $data['displayName']);
        self::assertSame('sonia@launchpad.test', $data['email']);
        self::assertNotNull($data['workspaceId']);
    }

    public function testPreflightCorsRequestIsAllowedForConfiguredOrigin(): void
    {
        $this->client->request('OPTIONS', self::PREFIX.'/files', server: [
            'HTTP_ORIGIN' => 'http://localhost:4200',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization',
        ]);

        $this->assertStatus(200);
        self::assertSame('http://localhost:4200', $this->client->getResponse()->headers->get('Access-Control-Allow-Origin'));
    }
}
