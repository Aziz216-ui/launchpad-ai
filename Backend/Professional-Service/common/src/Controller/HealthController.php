<?php

namespace Launchpad\Common\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Point de contrôle de disponibilité du service (utilisé par Eureka / supervision).
 */
final class HealthController
{
    public function __construct(
        #[Autowire(env: 'APP_SERVICE_NAME')] private readonly string $serviceName,
    ) {
    }

    #[Route('/health', name: 'health', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        return new JsonResponse([
            'status' => 'UP',
            'service' => $this->serviceName,
        ]);
    }
}
