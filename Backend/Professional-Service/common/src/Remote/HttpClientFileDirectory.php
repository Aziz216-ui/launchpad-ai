<?php

namespace Launchpad\Common\Remote;

use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * ClientFileDirectory via HTTP : GET {CLIENT_FILE_SERVICE_URL}/internal/files/{id}.
 * Les contextes sont mis en cache le temps de la requête (plusieurs voters les consultent).
 */
final class HttpClientFileDirectory implements ClientFileDirectory
{
    private readonly RemoteService $remote;

    /** @var array<string, FileContext|null> */
    private array $cache = [];

    public function __construct(#[Autowire(service: 'client_file_service.client')] HttpClientInterface $client)
    {
        $this->remote = new RemoteService($client, 'des dossiers clients');
    }

    public function context(string $fileId): ?FileContext
    {
        if (!\array_key_exists($fileId, $this->cache)) {
            $data = $this->remote->call('GET', '/internal/files/'.rawurlencode($fileId));
            $this->cache[$fileId] = null !== $data ? FileContext::fromArray($data) : null;
        }

        return $this->cache[$fileId];
    }

    public function participantFiles(string $userId, bool $accountant): array
    {
        $query = http_build_query([$accountant ? 'accountantId' : 'entrepreneurId' => $userId]);
        $data = $this->remote->call('GET', '/internal/files?'.$query) ?? [];

        return array_map(static fn (array $file): FileContext => FileContext::fromArray($file), array_values($data));
    }
}
