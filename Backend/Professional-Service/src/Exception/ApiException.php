<?php

namespace App\Exception;

use Symfony\Component\HttpFoundation\Response;

/**
 * Erreur métier convertie en réponse JSON par ApiExceptionListener.
 */
final class ApiException extends \RuntimeException
{
    /**
     * @param list<array{field: string, message: string}> $details
     */
    public function __construct(
        private readonly int $statusCode,
        private readonly string $errorCode,
        string $message,
        private readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $message = 'Ressource introuvable.'): self
    {
        return new self(Response::HTTP_NOT_FOUND, 'NOT_FOUND', $message);
    }

    /** Action incompatible avec l'état actuel de la ressource. */
    public static function conflict(string $errorCode, string $message): self
    {
        return new self(Response::HTTP_CONFLICT, $errorCode, $message);
    }

    public static function badRequest(string $errorCode, string $message): self
    {
        return new self(Response::HTTP_BAD_REQUEST, $errorCode, $message);
    }

    /** Erreur de validation portant sur un champ précis. */
    public static function invalidField(string $field, string $message): self
    {
        return new self(Response::HTTP_BAD_REQUEST, 'VALIDATION_FAILED', 'Les données envoyées sont invalides.', [
            ['field' => $field, 'message' => $message],
        ]);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /**
     * @return list<array{field: string, message: string}>
     */
    public function getDetails(): array
    {
        return $this->details;
    }
}
