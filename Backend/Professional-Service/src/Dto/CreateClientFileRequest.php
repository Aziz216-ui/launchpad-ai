<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Demande de dossier envoyée par l'entrepreneur au comptable choisi. */
final class CreateClientFileRequest
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Uuid]
        public readonly string $workspaceId = '',

        #[Assert\NotBlank]
        #[Assert\Length(max: 150)]
        public readonly string $startupName = '',

        #[Assert\Length(max: 64)]
        public readonly ?string $startupId = null,

        #[Assert\Length(max: 2000)]
        public readonly ?string $requestMessage = null,
    ) {
    }
}
