<?php

namespace App\Dto;

use Symfony\Component\Validator\Constraints as Assert;

final class SendMessageRequest
{
    public function __construct(
        #[Assert\NotBlank]
        #[Assert\Length(max: 5000)]
        public readonly string $content = '',

        /** Document du dossier concerné par le message (facultatif). */
        #[Assert\Uuid]
        public readonly ?string $documentId = null,
    ) {
    }
}
