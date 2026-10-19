<?php

namespace App\Entity;

use App\Enum\AssignmentType;
use App\Repository\ClientFileAssignmentRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Historique des affectations d'un dossier (jamais modifié).
 */
#[ORM\Entity(repositoryClass: ClientFileAssignmentRepository::class)]
#[ORM\Table(name: 'client_file_assignment')]
class ClientFileAssignment
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ClientFile $clientFile;

    #[ORM\Column(length: 30, enumType: AssignmentType::class)]
    private AssignmentType $type;

    /** Null pour l'affectation initiale. */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $previousAccountantId;

    #[ORM\Column(length: 64)]
    private string $newAccountantId;

    /** "sub" de l'auteur de l'affectation. */
    #[ORM\Column(length: 64)]
    private string $assignedBy;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $reason;

    #[ORM\Column]
    private \DateTimeImmutable $assignedAt;

    public function __construct(
        ClientFile $clientFile,
        AssignmentType $type,
        ?string $previousAccountantId,
        string $newAccountantId,
        string $assignedBy,
        ?string $reason = null,
    ) {
        $this->id = Uuid::v7();
        $this->clientFile = $clientFile;
        $this->type = $type;
        $this->previousAccountantId = $previousAccountantId;
        $this->newAccountantId = $newAccountantId;
        $this->assignedBy = $assignedBy;
        $this->reason = $reason;
        $this->assignedAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getClientFile(): ClientFile
    {
        return $this->clientFile;
    }

    public function getType(): AssignmentType
    {
        return $this->type;
    }

    public function getPreviousAccountantId(): ?string
    {
        return $this->previousAccountantId;
    }

    public function getNewAccountantId(): string
    {
        return $this->newAccountantId;
    }

    public function getAssignedBy(): string
    {
        return $this->assignedBy;
    }

    public function getReason(): ?string
    {
        return $this->reason;
    }

    public function getAssignedAt(): \DateTimeImmutable
    {
        return $this->assignedAt;
    }
}
