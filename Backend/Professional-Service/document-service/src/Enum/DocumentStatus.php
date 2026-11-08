<?php

namespace App\Enum;

enum DocumentStatus: string
{
    case PENDING = 'PENDING';
    case VALIDATED = 'VALIDATED';
    case REJECTED = 'REJECTED';
}
