<?php

namespace App\Remote;

use Launchpad\Common\Remote\RemoteService;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * GET {DOCUMENT_SERVICE_URL}/internal/documents/{id}
 */
final class HttpDocumentDirectory implements DocumentDirectory
{
    private readonly RemoteService $remote;

    public function __construct(#[Autowire(service: 'document_service.client')] HttpClientInterface $client)
    {
        $this->remote = new RemoteService($client, 'des documents');
    }

    public function find(string $documentId): ?DocumentRef
    {
        $data = $this->remote->call('GET', '/internal/documents/'.rawurlencode($documentId));

        return null !== $data ? DocumentRef::fromArray($data) : null;
    }
}
