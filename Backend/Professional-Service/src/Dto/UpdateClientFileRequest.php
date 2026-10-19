<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Modification partielle d'une demande encore en attente (champs absents = inchangés). */
final class UpdateClientFileRequest
{
    public function __construct(
        #[Assert\NotBlank(allowNull: true, normalizer: 'trim')]
        #[Assert\Length(max: 150)]
        public readonly ?string $startupName = null,

        #[Assert\Length(max: 64)]
        public readonly ?string $startupId = null,

        #[Assert\Length(max: 2000)]
        public readonly ?string $requestMessage = null,
    ) {
    }
}
