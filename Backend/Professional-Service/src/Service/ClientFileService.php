<?php

namespace App\Service;

use App\Dto\AssignClientFileRequest;
use App\Dto\CreateClientFileRequest;
use App\Dto\UpdateClientFileRequest;
use App\Entity\AccountantWorkspace;
use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;
use App\Enum\AssignmentType;
use App\Enum\ClientFileStatus;
use App\Exception\ApiException;
use App\Repository\AccountantWorkspaceRepository;
use App\Repository\ClientFileRepository;
use App\Security\KeycloakUser;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Cycle de vie des dossiers : demande, acceptation / refus, affectation, clôture.
 */
final class ClientFileService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ClientFileRepository $files,
        private readonly AccountantWorkspaceRepository $workspaces,
    ) {
    }

    public function create(CreateClientFileRequest $request, KeycloakUser $entrepreneur): ClientFile
    {
        $workspace = $this->findWorkspace($request->workspaceId);

        if (!$workspace->isAvailable()) {
            throw ApiException::conflict('WORKSPACE_UNAVAILABLE', 'Ce comptable n\'accepte pas de nouveaux clients.');
        }
        if ($this->files->hasOpenFile($entrepreneur->getId(), $workspace, $request->startupId, $request->startupName)) {
            throw ApiException::conflict('DUPLICATE_FILE', 'Une demande ou un dossier actif existe déjà pour cette startup chez ce comptable.');
        }

        $file = new ClientFile(
            reference: $this->files->nextReference((int) date('Y')),
            workspace: $workspace,
            entrepreneurId: $entrepreneur->getId(),
            startupName: $request->startupName,
            startupId: $request->startupId,
            requestMessage: $request->requestMessage,
            entrepreneurDisplayName: $entrepreneur->getDisplayName(),
        );

        $this->em->persist($file);
        $this->em->flush();

        return $file;
    }

    public function update(ClientFile $file, UpdateClientFileRequest $request): void
    {
        $this->assertStatus($file, ClientFileStatus::PENDING, 'Seule une demande en attente peut être modifiée.');

        if (null !== $request->startupName) {
            $file->setStartupName($request->startupName);
        }
        if (null !== $request->startupId) {
            $file->setStartupId($request->startupId);
        }
        if (null !== $request->requestMessage) {
            $file->setRequestMessage($request->requestMessage);
        }

        $this->em->flush();
    }

    public function accept(ClientFile $file, KeycloakUser $accountant): void
    {
        $this->assertStatus($file, ClientFileStatus::PENDING, 'Seule une demande en attente peut être acceptée.');

        $file->activate();
        $this->em->persist(new ClientFileAssignment(
            clientFile: $file,
            type: AssignmentType::ACCEPTANCE,
            previousAccountantId: null,
            newAccountantId: $accountant->getId(),
            assignedBy: $accountant->getId(),
        ));
        $this->em->flush();
    }

    public function reject(ClientFile $file, string $reason): void
    {
        $this->assertStatus($file, ClientFileStatus::PENDING, 'Seule une demande en attente peut être refusée.');

        $file->reject($reason);
        $this->em->flush();
    }

    /**
     * PENDING : affectation directe (le dossier passe ACTIVE, type ADMIN_ASSIGNMENT).
     * ACTIVE  : réaffectation vers un autre comptable (motif obligatoire, type ADMIN_REASSIGNMENT).
     */
    public function assign(ClientFile $file, AssignClientFileRequest $request, KeycloakUser $admin): void
    {
        $target = $this->findWorkspace($request->workspaceId);
        if (!$target->isActive()) {
            throw ApiException::conflict('WORKSPACE_INACTIVE', 'Impossible d\'affecter un dossier à un espace comptable désactivé.');
        }

        $reason = null !== $request->reason && '' !== trim($request->reason) ? trim($request->reason) : null;

        switch ($file->getStatus()) {
            case ClientFileStatus::PENDING:
                $type = AssignmentType::ADMIN_ASSIGNMENT;
                $previousAccountantId = null;
                $file->activate();
                break;

            case ClientFileStatus::ACTIVE:
                if ($file->getWorkspace() === $target) {
                    throw ApiException::conflict('ALREADY_ASSIGNED', 'Le dossier est déjà affecté à ce comptable.');
                }
                if (null === $reason) {
                    throw ApiException::invalidField('reason', 'Le motif est obligatoire pour une réaffectation.');
                }
                $type = AssignmentType::ADMIN_REASSIGNMENT;
                $previousAccountantId = $file->getWorkspace()->getAccountantId();
                break;

            default:
                throw ApiException::conflict('INVALID_STATUS', 'Un dossier refusé ou clôturé ne peut pas être affecté.');
        }

        $file->assignTo($target);
        $this->em->persist(new ClientFileAssignment(
            clientFile: $file,
            type: $type,
            previousAccountantId: $previousAccountantId,
            newAccountantId: $target->getAccountantId(),
            assignedBy: $admin->getId(),
            reason: $reason,
        ));
        $this->em->flush();
    }

    public function close(ClientFile $file): void
    {
        $this->assertStatus($file, ClientFileStatus::ACTIVE, 'Seul un dossier actif peut être clôturé.');

        $file->close();
        $this->em->flush();
    }

    private function findWorkspace(string $workspaceId): AccountantWorkspace
    {
        return $this->workspaces->find($workspaceId)
            ?? throw ApiException::invalidField('workspaceId', 'Espace comptable introuvable.');
    }

    private function assertStatus(ClientFile $file, ClientFileStatus $expected, string $message): void
    {
        if ($file->getStatus() !== $expected) {
            throw ApiException::conflict('INVALID_STATUS', $message);
        }
    }
}
