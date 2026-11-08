<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class RejectClientFileRequest
{
    public function __construct(
        #[Assert\NotBlank(normalizer: 'trim')]
        #[Assert\Length(max: 2000)]
        public readonly string $reason = '',
    ) {
    }
}
