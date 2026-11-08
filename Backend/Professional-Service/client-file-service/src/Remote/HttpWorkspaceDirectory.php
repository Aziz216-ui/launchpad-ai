<?php

namespace App\Remote;

use Launchpad\Common\Remote\RemoteService;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * GET {WORKSPACE_SERVICE_URL}/internal/workspaces/{id}
 */
final class HttpWorkspaceDirectory implements WorkspaceDirectory
{
    private readonly RemoteService $remote;

    public function __construct(#[Autowire(service: 'workspace_service.client')] HttpClientInterface $client)
    {
        $this->remote = new RemoteService($client, 'des espaces comptables');
    }

    public function find(string $workspaceId): ?WorkspaceInfo
    {
        $data = $this->remote->call('GET', '/internal/workspaces/'.rawurlencode($workspaceId));

        return null !== $data ? WorkspaceInfo::fromArray($data) : null;
    }
}
