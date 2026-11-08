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
}
