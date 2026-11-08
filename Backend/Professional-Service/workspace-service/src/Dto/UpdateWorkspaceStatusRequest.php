<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class UpdateWorkspaceStatusRequest
{
    public function __construct(
        #[Assert\NotNull]
        public readonly ?bool $active = null,
    ) {
    }
}
