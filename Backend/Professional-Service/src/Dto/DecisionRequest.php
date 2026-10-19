<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

/** Commentaire d'une décision (obligatoire pour un rejet ou une révision). */
final class DecisionRequest
{
    public function __construct(
        #[Assert\Length(max: 2000)]
        public readonly ?string $comment = null,
    ) {
    }
}
