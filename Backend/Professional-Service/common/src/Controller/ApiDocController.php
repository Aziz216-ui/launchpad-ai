<?php

namespace Launchpad\Common\Controller;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * Swagger UI (page statique, sans Twig) pour tester l'API depuis le navigateur.
 * C'est aussi la page ouverte depuis le tableau de bord Eureka.
 */
final class ApiDocController
{
    private const SWAGGER_UI_VERSION = '5.17.14';

    public function __construct(
        private readonly UrlGeneratorInterface $urlGenerator,
        #[Autowire(env: 'APP_SERVICE_NAME')] private readonly string $serviceName,
    ) {
    }

    #[Route('/docs', name: 'api_doc_ui', methods: ['GET'])]
    public function __invoke(): Response
    {
        $specUrl = json_encode($this->urlGenerator->generate('api_doc_json'), \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_SLASHES);
        $title = htmlspecialchars($this->serviceName);
        $cdn = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@'.self::SWAGGER_UI_VERSION;

        $html = <<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>{$title} — API LaunchPad</title>
                <link rel="stylesheet" href="{$cdn}/swagger-ui.css">
                <style>body { margin: 0; background: #fafafa; }</style>
            </head>
            <body>
                <div id="swagger-ui"></div>
                <script src="{$cdn}/swagger-ui-bundle.js"></script>
                <script>
                    window.ui = SwaggerUIBundle({
                        url: {$specUrl},
                        dom_id: '#swagger-ui',
                        deepLinking: true,
                        persistAuthorization: true,
                        displayRequestDuration: true,
                        tryItOutEnabled: true,
                        docExpansion: 'list',
                    });
                </script>
            </body>
            </html>
            HTML;

        return new Response($html, Response::HTTP_OK, ['Content-Type' => 'text/html; charset=UTF-8']);
    }
}
