<?php

namespace Launchpad\Common\Remote;

use Launchpad\Common\Remote\Model\FileContext;

/**
 * Accès en lecture aux dossiers clients pour les autres services (documents, messages).
 */
interface ClientFileDirectory
{
    /** Contexte du dossier, ou null s'il n'existe pas. */
    public function context(string $fileId): ?FileContext;

    /**
     * Dossiers auxquels l'utilisateur participe : ceux de l'entrepreneur, ou ceux actuellement affectés
     * au comptable (demandes comprises). Sert au centre de notifications.
     *
     * @return list<FileContext>
     */
    public function participantFiles(string $userId, bool $accountant): array;
}
