<?php

namespace App\Presenter;

use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;

/**
 * Représentation JSON des ressources de l'API (contrat explicite, indépendant des entités).
 */
final class ApiPresenter
{
    /**
     * @return array<string, mixed>
     */
    public function clientFile(ClientFile $file): array
    {
        return [
            'id' => $file->getId()->toRfc4122(),
            'reference' => $file->getReference(),
            'status' => $file->getStatus()->value,
            'startupId' => $file->getStartupId(),
            'startupName' => $file->getStartupName(),
            'entrepreneurId' => $file->getEntrepreneurId(),
            'entrepreneurDisplayName' => $file->getEntrepreneurDisplayName(),
            'requestMessage' => $file->getRequestMessage(),
            'rejectionReason' => $file->getRejectionReason(),
            'workspace' => [
                'id' => $file->getWorkspaceId()->toRfc4122(),
                'accountantId' => $file->getAccountantId(),
                'displayName' => $file->getAccountantDisplayName(),
            ],
            'decidedAt' => $this->date($file->getDecidedAt()),
            'closedAt' => $this->date($file->getClosedAt()),
            'createdAt' => $this->date($file->getCreatedAt()),
            'updatedAt' => $this->date($file->getUpdatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function assignment(ClientFileAssignment $assignment): array
    {
        return [
            'id' => $assignment->getId()->toRfc4122(),
            'type' => $assignment->getType()->value,
            'previousAccountantId' => $assignment->getPreviousAccountantId(),
            'newAccountantId' => $assignment->getNewAccountantId(),
            'assignedBy' => $assignment->getAssignedBy(),
            'reason' => $assignment->getReason(),
            'assignedAt' => $this->date($assignment->getAssignedAt()),
        ];
    }

    private function date(?\DateTimeImmutable $date): ?string
    {
        return $date?->format(\DateTimeInterface::ATOM);
    }
}
