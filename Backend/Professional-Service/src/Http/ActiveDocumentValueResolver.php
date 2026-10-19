<?php

namespace App\Http;

use App\Entity\AccountingDocument;
use App\Exception\ApiException;
use App\Repository\AccountingDocumentRepository;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Controller\ValueResolverInterface;
use Symfony\Component\HttpKernel\ControllerMetadata\ArgumentMetadata;

/**
 * Résout un AccountingDocument depuis {id} en ignorant les documents supprimés
 * logiquement (404), avant le résolveur Doctrine par défaut.
 */
#[AutoconfigureTag('controller.argument_value_resolver', ['priority' => 150])]
final class ActiveDocumentValueResolver implements ValueResolverInterface
{
    public function __construct(private readonly AccountingDocumentRepository $documents)
    {
    }

    /**
     * @return iterable<AccountingDocument>
     */
    public function resolve(Request $request, ArgumentMetadata $argument): iterable
    {
        if (AccountingDocument::class !== $argument->getType() || !\is_string($id = $request->attributes->get('id'))) {
            return [];
        }

        $document = $this->documents->find($id);
        if (null === $document || $document->isDeleted()) {
            throw ApiException::notFound('Document introuvable.');
        }

        return [$document];
    }
}
