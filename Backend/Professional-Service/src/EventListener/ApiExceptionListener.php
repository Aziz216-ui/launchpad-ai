<?php

namespace App\EventListener;

use App\Exception\ApiException;
use App\Http\ApiResponse;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Validator\ConstraintViolationListInterface;
use Symfony\Component\Validator\Exception\ValidationFailedException;

/**
 * Gestionnaire d'erreurs global : toute exception devient une réponse JSON
 * {"error": {"status", "code", "message", "details"}}.
 *
 * Priorité 0 : s'exécute après le listener de sécurité (priorité 1), qui gère
 * l'absence d'authentification (401 via JsonAuthenticationEntryPoint).
 */
#[AsEventListener(event: KernelEvents::EXCEPTION, priority: 0)]
final class ApiExceptionListener
{
    private const MESSAGES = [
        Response::HTTP_BAD_REQUEST => ['BAD_REQUEST', 'Requête invalide.'],
        Response::HTTP_UNAUTHORIZED => ['UNAUTHORIZED', 'Authentification requise.'],
        Response::HTTP_FORBIDDEN => ['FORBIDDEN', 'Accès refusé.'],
        Response::HTTP_NOT_FOUND => ['NOT_FOUND', 'Ressource introuvable.'],
        Response::HTTP_METHOD_NOT_ALLOWED => ['METHOD_NOT_ALLOWED', 'Méthode HTTP non autorisée.'],
        Response::HTTP_UNSUPPORTED_MEDIA_TYPE => ['UNSUPPORTED_MEDIA_TYPE', 'Type de contenu non pris en charge.'],
        Response::HTTP_UNPROCESSABLE_ENTITY => ['VALIDATION_FAILED', 'Les données envoyées sont invalides.'],
    ];

    public function __construct(
        private readonly LoggerInterface $logger,
        #[Autowire('%kernel.debug%')] private readonly bool $debug,
    ) {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        $exception = $event->getThrowable();

        $event->setResponse(match (true) {
            $exception instanceof ApiException => ApiResponse::error(
                $exception->getStatusCode(),
                $exception->getErrorCode(),
                $exception->getMessage(),
                $exception->getDetails(),
            ),
            $exception->getPrevious() instanceof ValidationFailedException => ApiResponse::error(
                Response::HTTP_BAD_REQUEST,
                'VALIDATION_FAILED',
                'Les données envoyées sont invalides.',
                $this->violations($exception->getPrevious()->getViolations()),
            ),
            $exception instanceof AccessDeniedException => $this->fromStatus(Response::HTTP_FORBIDDEN),
            $exception instanceof HttpExceptionInterface => $this->fromHttpException($exception),
            default => $this->internalError($exception),
        });
    }

    private function fromHttpException(HttpExceptionInterface $exception): Response
    {
        $response = $this->fromStatus($exception->getStatusCode());
        $response->headers->add($exception->getHeaders());

        return $response;
    }

    private function fromStatus(int $status): Response
    {
        [$code, $message] = self::MESSAGES[$status] ?? ['HTTP_ERROR', Response::$statusTexts[$status] ?? 'Erreur.'];

        // Les erreurs de validation des DTO sont renvoyées en 400 (et non 422)
        if (Response::HTTP_UNPROCESSABLE_ENTITY === $status) {
            $status = Response::HTTP_BAD_REQUEST;
        }

        return ApiResponse::error($status, $code, $message);
    }

    private function internalError(\Throwable $exception): Response
    {
        $this->logger->error('Unhandled exception: {message}', ['message' => $exception->getMessage(), 'exception' => $exception]);

        $response = ApiResponse::error(Response::HTTP_INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', 'Erreur interne du serveur.');
        if ($this->debug) {
            // Détail uniquement en développement
            $response->setData(['error' => [
                'status' => 500,
                'code' => 'INTERNAL_ERROR',
                'message' => 'Erreur interne du serveur.',
                'debug' => $exception::class.': '.$exception->getMessage(),
            ]]);
        }

        return $response;
    }

    /**
     * @return list<array{field: string, message: string}>
     */
    private function violations(ConstraintViolationListInterface $violations): array
    {
        $details = [];
        foreach ($violations as $violation) {
            $details[] = ['field' => $violation->getPropertyPath(), 'message' => (string) $violation->getMessage()];
        }

        return $details;
    }
}
