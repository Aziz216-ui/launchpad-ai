<?php

namespace App\Http;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Format unique des réponses JSON de l'API :
 * - succès : {"data": ...}  (listes : {"data": [...], "meta": {...}})
 * - erreur : {"error": {"status", "code", "message", "details"}}
 */
final class ApiResponse
{
    private const JSON_OPTIONS = \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_PRESERVE_ZERO_FRACTION;

    public static function data(mixed $data, int $status = Response::HTTP_OK): JsonResponse
    {
        return self::json(['data' => $data], $status);
    }

    /**
     * @param array<string, mixed> $payload liste déjà formatée par le PaginationFormatter
     */
    public static function page(array $payload): JsonResponse
    {
        return self::json($payload, Response::HTTP_OK);
    }

    public static function noContent(): Response
    {
        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * @param list<array{field: string, message: string}> $details
     */
    public static function error(int $status, string $code, string $message, array $details = []): JsonResponse
    {
        $error = ['status' => $status, 'code' => $code, 'message' => $message];
        if ([] !== $details) {
            $error['details'] = $details;
        }

        return self::json(['error' => $error], $status);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function json(array $payload, int $status): JsonResponse
    {
        $response = new JsonResponse(null, $status);
        $response->setEncodingOptions(self::JSON_OPTIONS);

        return $response->setData($payload);
    }
}
