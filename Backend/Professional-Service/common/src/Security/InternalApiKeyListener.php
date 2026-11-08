<?php

namespace Launchpad\Common\Security;

use Launchpad\Common\Http\ApiResponse;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Protège les routes /internal/** (appels entre microservices) par une clé partagée
 * envoyée dans l'en-tête X-Internal-Key. Ces routes ne doivent jamais être exposées au frontend.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 256)]
final class InternalApiKeyListener
{
    public const HEADER = 'X-Internal-Key';

    public function __construct(
        #[Autowire(env: 'INTERNAL_API_KEY')] private readonly string $internalApiKey,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        $request = $event->getRequest();
        if (!$event->isMainRequest() || !str_starts_with($request->getPathInfo(), '/internal/')) {
            return;
        }

        $key = (string) $request->headers->get(self::HEADER, '');
        if ('' === $this->internalApiKey || !hash_equals($this->internalApiKey, $key)) {
            $event->setResponse(ApiResponse::error(Response::HTTP_UNAUTHORIZED, 'INVALID_INTERNAL_KEY', 'Clé interne absente ou invalide.'));
        }
    }
}
