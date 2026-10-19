<?php

namespace App\Tests\Security;

use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Faux Keycloak pour l'environnement de test : répond aux appels de découverte OIDC
 * du handler Symfony (.well-known/openid-configuration puis JWKS) avec les clés de test.
 * Le code de production (découverte, cache, vérification) est donc exercé tel quel.
 */
final class KeycloakMockResponseFactory
{
    public function __construct(private readonly string $issuer)
    {
    }

    public function __invoke(string $method, string $url, array $options = []): ResponseInterface
    {
        $jwksUri = $this->issuer.'/protocol/openid-connect/certs';

        return match ($url) {
            $this->issuer.'/.well-known/openid-configuration' => $this->json([
                'issuer' => $this->issuer,
                'jwks_uri' => $jwksUri,
            ]),
            $jwksUri => $this->json(TestKeys::publicJwks()),
            default => new MockResponse('Not Found', ['http_code' => 404]),
        };
    }

    private function json(array $data): MockResponse
    {
        return new MockResponse(json_encode($data, \JSON_THROW_ON_ERROR), [
            'http_code' => 200,
            'response_headers' => ['Content-Type' => 'application/json'],
        ]);
    }
}
