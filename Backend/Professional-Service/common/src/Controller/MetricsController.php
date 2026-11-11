<?php

namespace Launchpad\Common\Controller;

use Prometheus\CollectorRegistry;
use Prometheus\RenderTextFormat;
use Prometheus\Storage\APC;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Métriques Prometheus (format texte), partagées par les quatre microservices comptables.
 */
final class MetricsController
{
    public function __construct(
        #[Autowire(env: 'APP_SERVICE_NAME')] private readonly string $serviceName,
    ) {
    }

    #[Route('/metrics', name: 'metrics', methods: ['GET'])]
    public function __invoke(): Response
    {
        $registry = new CollectorRegistry(new APC());

        $registry->getOrRegisterCounter(
            'launchpad',
            'comptable_up',
            'Service comptable disponible',
            ['service'],
        )->inc(['service' => $this->serviceName]);

        $renderer = new RenderTextFormat();

        return new Response(
            $renderer->render($registry->getMetricFamilySamples()),
            Response::HTTP_OK,
            ['Content-Type' => RenderTextFormat::MIME_TYPE],
        );
    }
}
