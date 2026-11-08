<?php

namespace App\Enum;

/**
 * Cycle de vie d'un dossier client :
 * PENDING (demande de l'entrepreneur) -> ACTIVE (acceptée / affectée) | REJECTED (refusée)
 * ACTIVE -> CLOSED (clôturé).
 */
enum ClientFileStatus: string
{
    case PENDING = 'PENDING';
    case ACTIVE = 'ACTIVE';
    case REJECTED = 'REJECTED';
    case CLOSED = 'CLOSED';

    /** Les échanges (messages) sont possibles tant que le dossier n'est pas terminé. */
    public function isOpen(): bool
    {
        return self::PENDING === $this || self::ACTIVE === $this;
    }
}
