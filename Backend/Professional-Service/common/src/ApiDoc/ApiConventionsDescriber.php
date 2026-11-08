<?php

namespace Launchpad\Common\ApiDoc;

use Nelmio\ApiDocBundle\Describer\DescriberInterface;
use Nelmio\ApiDocBundle\OpenApiPhp\Util;
use OpenApi\Annotations as OA;
use OpenApi\Generator;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Complète la documentation OpenAPI avec les conventions communes de l'API,
 * sans surcharger chaque contrôleur d'attributs :
 * tags, codes de succès, format {data}/{data, meta}, erreurs JSON et paramètres de pagination / filtres.
 *
 * Les éléments sont créés via Util (nelmio) pour être correctement rattachés à leur parent.
 */
final class ApiConventionsDescriber implements DescriberInterface
{
    public function __construct(
        #[Autowire(env: 'APP_SERVICE_NAME')] private readonly string $serviceName,
    ) {
    }

    /** Opérations qui créent une ressource (201). */
    private const CREATED = [
        'post_file_create', 'post_document_upload', 'post_document_declare_external', 'post_document_new_version',
        'post_document_new_external_version', 'post_document_validate', 'post_document_reject', 'post_message_send',
    ];

    /** Listes paginées et leurs filtres propres : nom => [type, description, valeurs possibles]. */
    private const LISTS = [
        'get_workspace_list' => ['all' => ['boolean', 'Admin : inclut les espaces inactifs ou fermés aux demandes']],
        'get_file_list' => ['status' => ['string', 'Filtre par statut', ['PENDING', 'ACTIVE', 'REJECTED', 'CLOSED']]],
        'get_file_assignments' => [],
        'get_document_list' => [
            'includeHistory' => ['boolean', 'Inclut les versions remplacées'],
            'status' => ['string', 'Filtre par statut', ['PENDING', 'VALIDATED', 'REJECTED']],
            'type' => ['string', 'Filtre par type', ['BALANCE_SHEET', 'INCOME_STATEMENT', 'INVOICE', 'BANK_STATEMENT', 'FINANCIAL_FORECAST', 'BUDGET', 'TAX_RETURN', 'PAYROLL', 'REPORT', 'OTHER']],
        ],
        'get_document_validations' => [],
        'get_document_events' => [],
        'get_message_list' => [],
    ];

    public function describe(OA\OpenApi $api): void
    {
        if (Generator::UNDEFINED === $api->paths) {
            return;
        }

        foreach ($api->paths as $pathItem) {
            foreach (['get', 'post', 'put', 'patch', 'delete'] as $method) {
                $operation = $pathItem->{$method};
                if ($operation instanceof OA\Operation) {
                    $this->describeOperation($operation, $pathItem->path, $method);
                }
            }
        }
    }

    private function describeOperation(OA\Operation $operation, string $path, string $method): void
    {
        $operation->tags = [$this->tagFor($path)];
        $id = (string) $operation->operationId;
        $isPublic = str_ends_with($path, '/health');

        if ($isPublic) {
            $operation->security = [];
        }

        if (isset(self::LISTS[$id])) {
            $this->addListParameters($operation, self::LISTS[$id]);
        }

        if (Generator::UNDEFINED === $operation->responses || [] === $operation->responses) {
            $this->addSuccessResponse($operation, $id, $method);
        }

        if ($isPublic) {
            return;
        }

        $errors = [
            '401' => 'Jeton absent, invalide ou expiré',
            '403' => 'Rôle ou droits insuffisants',
        ];
        // Le corps de requête (DTO) est décrit plus tard par nelmio : on se fie à la méthode HTTP
        if ('get' !== $method || isset(self::LISTS[$id]) || str_contains($path, '{id}')) {
            $errors['400'] = 'Données ou paramètres invalides (détail par champ)';
        }
        if (str_contains($path, '{id}')) {
            $errors['404'] = 'Ressource introuvable';
        }
        if ('get' !== $method) {
            $errors['409'] = 'Action incompatible avec l\'état actuel (statut du dossier ou du document)';
        }

        ksort($errors);
        foreach ($errors as $code => $description) {
            $response = $this->response($operation, (string) $code, $description);
            $this->jsonSchema($response)->ref = '#/components/schemas/Error';
        }
    }

    private function addSuccessResponse(OA\Operation $operation, string $id, string $method): void
    {
        if ('delete' === $method) {
            $this->response($operation, '204', 'Supprimé (suppression logique)');

            return;
        }

        if ('get_document_download' === $id) {
            $response = $this->response($operation, '200', 'Contenu du fichier (Content-Disposition: attachment)');
            /** @var OA\MediaType $mediaType */
            $mediaType = Util::getCollectionItem($response, OA\MediaType::class, ['mediaType' => 'application/octet-stream']);
            $schema = Util::getChild($mediaType, OA\Schema::class);
            $schema->type = 'string';
            $schema->format = 'binary';

            return;
        }

        if ('get_health' === $id) {
            $schema = $this->jsonSchema($this->response($operation, '200', 'Service disponible'));
            $schema->type = 'object';
            $schema->example = ['status' => 'UP', 'service' => $this->serviceName];

            return;
        }

        if (isset(self::LISTS[$id])) {
            $schema = $this->jsonSchema($this->response($operation, '200', 'Page de résultats'));
            $schema->type = 'object';
            /** @var OA\Property $data */
            $data = Util::getProperty($schema, 'data');
            $data->type = 'array';
            Util::getChild($data, OA\Items::class, ['type' => 'object']);
            Util::getProperty($schema, 'meta')->ref = '#/components/schemas/PaginationMeta';

            return;
        }

        $created = \in_array($id, self::CREATED, true);
        $schema = $this->jsonSchema($this->response($operation, $created ? '201' : '200', $created ? 'Ressource créée' : 'Succès'));
        $schema->type = 'object';
        Util::getProperty($schema, 'data')->type = 'object';
    }

    /**
     * @param array<string, array{0: string, 1: string, 2?: list<string>}> $filters
     */
    private function addListParameters(OA\Operation $operation, array $filters): void
    {
        $definitions = [
            'page' => ['integer', 'Numéro de page (à partir de 1)', null, ['minimum' => 1, 'default' => 1]],
            'limit' => ['integer', 'Éléments par page (100 au maximum)', null, ['minimum' => 1, 'maximum' => 100, 'default' => 20]],
        ];
        foreach ($filters as $name => $filter) {
            $definitions[$name] = [$filter[0], $filter[1], $filter[2] ?? null, []];
        }

        foreach ($definitions as $name => [$type, $description, $enum, $constraints]) {
            $parameter = Util::getOperationParameter($operation, $name, 'query');
            $parameter->required = false;
            $parameter->description = $description;

            /** @var OA\Schema $schema */
            $schema = Util::getChild($parameter, OA\Schema::class);
            $schema->type = $type;
            if (null !== $enum) {
                $schema->enum = $enum;
            }
            foreach ($constraints as $property => $value) {
                $schema->{$property} = $value;
            }
        }
    }

    private function response(OA\Operation $operation, string $code, string $description): OA\Response
    {
        /** @var OA\Response $response */
        $response = Util::getIndexedCollectionItem($operation, OA\Response::class, $code);
        if (Generator::UNDEFINED === $response->description || '' === $response->description) {
            $response->description = $description;
        }

        return $response;
    }

    private function jsonSchema(OA\Response $response): OA\Schema
    {
        /** @var OA\MediaType $mediaType */
        $mediaType = Util::getCollectionItem($response, OA\MediaType::class, ['mediaType' => 'application/json']);

        /** @var OA\Schema $schema */
        $schema = Util::getChild($mediaType, OA\Schema::class);

        return $schema;
    }

    private function tagFor(string $path): string
    {
        return match (true) {
            str_ends_with($path, '/health') => 'Santé',
            str_contains($path, '/workspaces') => 'Espaces comptables',
            str_ends_with($path, '/me') => 'Utilisateur',
            str_contains($path, '/messages') => 'Messages',
            str_contains($path, '/documents') => 'Documents',
            default => 'Dossiers',
        };
    }
}
