<?php

namespace Launchpad\Common\Http;

use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Controller\ValueResolverInterface;
use Symfony\Component\HttpKernel\ControllerMetadata\ArgumentMetadata;

/**
 * Résout un argument FileContext depuis {id} (route /files/{id}/...) auprès de client-file-service.
 */
#[AutoconfigureTag('controller.argument_value_resolver', ['priority' => 150])]
final class FileContextValueResolver implements ValueResolverInterface
{
    public function __construct(private readonly ClientFileDirectory $files)
    {
    }

    /**
     * @return iterable<FileContext>
     */
    public function resolve(Request $request, ArgumentMetadata $argument): iterable
    {
        if (FileContext::class !== $argument->getType() || !\is_string($id = $request->attributes->get('id'))) {
            return [];
        }

        return [$this->files->context($id) ?? throw ApiException::notFound('Dossier introuvable.')];
    }
}
