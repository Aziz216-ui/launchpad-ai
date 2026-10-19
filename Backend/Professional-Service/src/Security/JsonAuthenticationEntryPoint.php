<?php

namespace App\Security;

use App\Http\ApiResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;

/**
 * 401 JSON lorsqu'aucun jeton n'est fourni sur une route protégée.
 */
final class JsonAuthenticationEntryPoint implements AuthenticationEntryPointInterface
{
    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        $response = ApiResponse::error(Response::HTTP_UNAUTHORIZED, 'UNAUTHORIZED', 'Authentification requise : jeton d\'accès manquant.');
        $response->headers->set('WWW-Authenticate', 'Bearer');

        return $response;
    }
}
