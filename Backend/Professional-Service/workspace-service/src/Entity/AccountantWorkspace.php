<?php

namespace App\Entity;

use App\Repository\AccountantWorkspaceRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

/**
 * Espace comptable : créé automatiquement à la première requête d'un utilisateur ROLE_ACCOUNTANT.
 */
#[ORM\Entity(repositoryClass: AccountantWorkspaceRepository::class)]
#[ORM\Table(name: 'accountant_workspace')]
#[ORM\HasLifecycleCallbacks]
class AccountantWorkspace
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    /** Identifiant Keycloak (claim "sub") du comptable. */
    #[ORM\Column(length: 64, unique: true)]
    private string $accountantId;

    /** Copie d'affichage, rafraîchie depuis le jeton : pas une source de vérité. */
    #[ORM\Column(length: 150)]
    private string $displayName;

    #[ORM\Column]
    private bool $acceptingClients = false;

    #[ORM\Column]
    private bool $active = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(string $accountantId, string $displayName)
    {
        $this->id = Uuid::v7();
        $this->accountantId = $accountantId;
        $this->displayName = $displayName;
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getAccountantId(): string
    {
        return $this->accountantId;
    }

    public function getDisplayName(): string
    {
        return $this->displayName;
    }

    public function setDisplayName(string $displayName): void
    {
        $this->displayName = $displayName;
    }

    public function isAcceptingClients(): bool
    {
        return $this->acceptingClients;
    }

    public function setAcceptingClients(bool $acceptingClients): void
    {
        $this->acceptingClients = $acceptingClients;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function setActive(bool $active): void
    {
        $this->active = $active;
    }

    /** Visible dans l'annuaire proposé aux entrepreneurs. */
    public function isAvailable(): bool
    {
        return $this->active && $this->acceptingClients;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
