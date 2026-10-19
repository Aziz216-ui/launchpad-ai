<?php

namespace App\Dto;

use App\Enum\DocumentType;
use Symfony\Component\Validator\Constraints as Assert;

/** Champs du formulaire multipart accompagnant le fichier déposé. */
final class UploadDocumentRequest
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 200)]
        public readonly string $title = '',

        #[Assert\NotNull]
        public readonly ?DocumentType $type = null,

        public readonly ?\DateTimeImmutable $periodStart = null,

        #[Assert\GreaterThanOrEqual(propertyPath: 'periodStart', message: 'La fin de période doit être postérieure ou égale au début.')]
        public readonly ?\DateTimeImmutable $periodEnd = null,
    ) {
    }
}
