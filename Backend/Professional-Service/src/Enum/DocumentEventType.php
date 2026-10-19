<?php

namespace App\Enum;

/**
 * Événements de traçabilité d'un document (hors décisions de validation).
 */
enum DocumentEventType: string
{
    case DELETED = 'DELETED';
}
