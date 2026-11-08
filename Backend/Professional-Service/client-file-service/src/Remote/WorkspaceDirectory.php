<?php

namespace App\Remote;

/**
 * Lecture des espaces comptables auprès de workspace-service.
 */
interface WorkspaceDirectory
{
    public function find(string $workspaceId): ?WorkspaceInfo;
}
