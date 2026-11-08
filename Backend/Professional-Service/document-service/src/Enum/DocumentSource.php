<?php

namespace App\Enum;

enum DocumentSource: string
{
    /** Fichier déposé et stocké par ce service (DocumentStorageInterface). */
    case UPLOAD = 'UPLOAD';
    /** Simple référence vers un document détenu par un autre service. */
    case EXTERNAL = 'EXTERNAL';
}
