<?php

namespace Launchpad\Common\Testing;

use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;

/**
 * Doublure de client-file-service pour les tests : les dossiers du catalogue des fixtures,
 * modifiables par le test (ex. dossier clôturé, espace du comptable désactivé).
 */
final class FakeClientFileDirectory implements ClientFileDirectory
{
    /** @var array<string, FileContext> */
    private array $overrides = [];

    public function context(string $fileId): ?FileContext
    {
        return $this->overrides[$fileId] ?? FixtureCatalog::fileContext($fileId);
    }

    public function override(FileContext $context): void
    {
        $this->overrides[$context->id] = $context;
    }

    /** Modifie le statut d'un dossier du catalogue. */
    public function withStatus(string $fileId, string $status): void
    {
        $current = $this->context($fileId) ?? throw new \InvalidArgumentException("Dossier $fileId inconnu.");
        $this->override(new FileContext($current->id, $current->reference, $status, $current->entrepreneurId, $current->accountantId, $current->workspaceActive));
    }
}
