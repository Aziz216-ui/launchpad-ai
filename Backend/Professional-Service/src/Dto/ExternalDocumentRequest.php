<?php

namespace App\Dto;

use App\Enum\DocumentType;
use Symfony\Component\Validator\Constraints as Assert;

/** Déclaration d'un document détenu par un autre service (aucun fichier local). */
final class ExternalDocumentRequest
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 200)]
        public readonly string $title = '',

        #[Assert\NotNull]
        public readonly ?DocumentType $type = null,

        #[Assert\NotBlank]
        #[Assert\Length(max: 255)]
        public readonly string $externalRef = '',

        /** Nom technique du service source, ex. financial-service. */
        #[Assert\NotBlank]
        #[Assert\Length(max: 50)]
        #[Assert\Regex(pattern: '/^[a-z0-9][a-z0-9-]*$/', message: 'Utilisez des minuscules, chiffres et tirets (ex. financial-service).')]
        public readonly string $externalService = '',

        public readonly ?\DateTimeImmutable $periodStart = null,

        #[Assert\GreaterThanOrEqual(propertyPath: 'periodStart', message: 'La fin de période doit être postérieure ou égale au début.')]
        public readonly ?\DateTimeImmutable $periodEnd = null,
    ) {
    }
}
