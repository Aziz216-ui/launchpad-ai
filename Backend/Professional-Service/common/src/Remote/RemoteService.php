<?php

namespace Launchpad\Common\Remote;

use Launchpad\Common\Exception\ApiException;
use Symfony\Contracts\HttpClient\Exception\ExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Appel JSON vers la route /internal d'un autre microservice.
 * Le client HTTP est un client « scopé » (base_uri + clé interne, voir framework.yaml).
 * 404 → null ; service injoignable ou en erreur → 503 SERVICE_UNAVAILABLE.
 */
final class RemoteService
{
    public function __construct(
        private readonly HttpClientInterface $client,
        private readonly string $serviceName,
    ) {
    }

    /**
     * @param array<string, mixed>|null $json
     *
     * @return array<string, mixed>|null le bloc "data" de la réponse
     */
    public function call(string $method, string $path, ?array $json = null): ?array
    {
        try {
            $response = $this->client->request($method, $path, null !== $json ? ['json' => $json] : []);
            $status = $response->getStatusCode();
            if (404 === $status) {
                return null;
            }
            if ($status >= 300) {
                throw ApiException::serviceUnavailable($this->serviceName);
            }

            return $response->toArray()['data'] ?? [];
        } catch (ExceptionInterface) {
            throw ApiException::serviceUnavailable($this->serviceName);
        }
    }
}
