<?php

namespace App\Tests\Security;

use Jose\Component\Core\AlgorithmManager;
use Jose\Component\Core\JWK;
use Jose\Component\Signature\Algorithm\RS256;
use Jose\Component\Signature\JWSBuilder;
use Jose\Component\Signature\Serializer\CompactSerializer;

/**
 * Fabrique de JWT au format Keycloak, signés avec la clé de test.
 */
final class TestTokenFactory
{
    /**
     * @param list<string>         $realmRoles   rôles Keycloak (realm_access.roles)
     * @param array<string, mixed> $claimsOverride claims à ajouter / remplacer (iss, aud, exp...)
     */
    public static function create(string $sub, array $realmRoles, array $claimsOverride = [], ?JWK $signingKey = null): string
    {
        $now = time();

        $claims = array_merge([
            'iss' => $_SERVER['KEYCLOAK_ISSUER'] ?? $_ENV['KEYCLOAK_ISSUER'],
            'aud' => [$_SERVER['KEYCLOAK_AUDIENCE'] ?? $_ENV['KEYCLOAK_AUDIENCE'], 'account'],
            'azp' => $_SERVER['KEYCLOAK_CLIENT_ID'] ?? $_ENV['KEYCLOAK_CLIENT_ID'],
            'sub' => $sub,
            'iat' => $now,
            'exp' => $now + 300,
            'typ' => 'Bearer',
            'realm_access' => ['roles' => [...$realmRoles, 'offline_access', 'default-roles-launchpad']],
        ], $claimsOverride);

        $jws = (new JWSBuilder(new AlgorithmManager([new RS256()])))
            ->create()
            ->withPayload(json_encode($claims, \JSON_THROW_ON_ERROR))
            ->addSignature($signingKey ?? TestKeys::privateKey(), ['alg' => 'RS256', 'typ' => 'JWT', 'kid' => TestKeys::KEY_ID])
            ->build();

        return (new CompactSerializer())->serialize($jws, 0);
    }
}
