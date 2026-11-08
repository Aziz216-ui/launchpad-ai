<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Affectation (demande en attente) ou réaffectation (dossier actif) par un administrateur. */
final class AssignClientFileRequest
{
    public function __construct(
        #[Assert\NotBlank(normalizer: 'trim')]
        #[Assert\Uuid]
        public readonly string $workspaceId = '',

        /** Obligatoire pour une réaffectation. */
        #[Assert\Length(max: 2000)]
        public readonly ?string $reason = null,
    ) {
    }
}
