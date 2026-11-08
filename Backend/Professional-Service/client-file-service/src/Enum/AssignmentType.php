<?php

namespace App\Enum;

/**
 * Origine d'une ligne de l'historique d'affectation d'un dossier.
 */
enum AssignmentType: string
{
    /** Le comptable a accepté la demande de l'entrepreneur. */
    case ACCEPTANCE = 'ACCEPTANCE';
    /** Un administrateur a affecté directement une demande en attente. */
    case ADMIN_ASSIGNMENT = 'ADMIN_ASSIGNMENT';
    /** Un administrateur a transféré un dossier actif vers un autre comptable. */
    case ADMIN_REASSIGNMENT = 'ADMIN_REASSIGNMENT';
}
