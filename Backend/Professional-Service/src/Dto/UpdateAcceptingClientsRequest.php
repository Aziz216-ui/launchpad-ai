<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class UpdateAcceptingClientsRequest
{
    public function __construct(
        #[Assert\NotNull]
        public readonly ?bool $acceptingClients = null,
    ) {
    }
}
