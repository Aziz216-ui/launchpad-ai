<?php

namespace App\Tests\Double;

use App\Remote\WorkspaceDirectory;
use App\Remote\WorkspaceInfo;
use Launchpad\Common\Fixtures\FixtureCatalog;

/**
 * Doublure de workspace-service : les espaces du catalogue des fixtures.
 */
final class FakeWorkspaceDirectory implements WorkspaceDirectory
{
    public function find(string $workspaceId): ?WorkspaceInfo
    {
        $data = FixtureCatalog::WORKSPACES[$workspaceId] ?? null;

        return null !== $data
            ? new WorkspaceInfo($workspaceId, $data['accountantId'], $data['displayName'], $data['acceptingClients'], $data['active'])
            : null;
    }
}
