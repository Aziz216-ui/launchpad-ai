<?php

namespace App\Enum;

enum ValidationDecision: string
{
    case VALIDATED = 'VALIDATED';
    case REJECTED = 'REJECTED';

    /** Statut du document résultant de cette décision. */
    public function toDocumentStatus(): DocumentStatus
    {
        return match ($this) {
            self::VALIDATED => DocumentStatus::VALIDATED,
            self::REJECTED => DocumentStatus::REJECTED,
        };
    }
}
